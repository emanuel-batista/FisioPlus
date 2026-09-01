/**
 * Módulo ColorTracker de Alto Desempenho para Detecção dos Marcadores da Barra
 * Rastreia a bola de isopor Verde (ponta 1) e Vermelha (ponta 2).
 * Usa conversão RGB -> HSV rápida em resolução reduzida para manter 60 FPS e baixo uso de memória.
 */

export class ColorTracker {
  constructor() {
    this.enabled = true;
    this.debugCanvas = null;
    this.debugCtx = null;
    
    // Canvas offscreen de baixa resolução para processamento rápido
    this.downscaleFactor = 0.5; // Processa em metade da resolução para economizar CPU/RAM
    this.processCanvas = document.createElement("canvas");
    this.processCtx = this.processCanvas.getContext("2d", { willReadFrequently: true });

    // Faixas de cores HSV padrão (H: 0-360, S: 0-100, V: 0-100)
    this.colorRanges = {
      // Verde: Tom de verde vibrante (geralmente 70° a 170°)
      green: {
        hMin: 70,
        hMax: 170,
        sMin: 25,
        sMax: 100,
        vMin: 20,
        vMax: 100
      },
      // Vermelho: Envolve o 0° (340°-360° e 0°-25°)
      red: {
        hMin1: 0,
        hMax1: 12,  // Reduzido para evitar capturar os tons de laranja da pele
        hMin2: 345,
        hMax2: 360,
        sMin: 60,   // Aumentado drasticamente para ignorar a pele (que costuma ter S < 40%)
        sMax: 100,
        vMin: 60,   // Aumentado para evitar sombras e dobras na roupa
        vMax: 100
      }
    };

    // Posições suavizadas anteriores (para filtro EMA anti-jitter)
    this.smoothGreen = null;
    this.smoothRed = null;
    this.smoothingAlpha = 0.45; // 0 = estático, 1 = sem suavização

    // Estado da barra detectada
    this.barState = {
      detected: false,
      hasGreen: false,
      hasRed: false,
      greenPos: null,  // { x: [0..1], y: [0..1], count }
      redPos: null,    // { x: [0..1], y: [0..1], count }
      tiltAngle: 0,    // Ângulo de inclinação em graus
      center: null,    // { x, y }
      barLength: 0,    // Comprimento normalizado da barra
      isLevel: true    // Se a barra está nivelada horizontalmente
    };
  }

  /**
   * Converte RGB para HSV
   * r, g, b no intervalo [0, 255]
   * Retorna { h: 0..360, s: 0..100, v: 0..100 }
   */
  rgbToHsv(r, g, b) {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;

    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const v = max * 100;

    if (max !== 0) {
      s = (delta / max) * 100;
    }

    if (delta !== 0) {
      if (max === rf) {
        h = ((gf - bf) / delta) % 6;
      } else if (max === gf) {
        h = (bf - rf) / delta + 2;
      } else {
        h = (rf - gf) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, v };
  }

  /**
   * Processa um elemento de vídeo para encontrar os centróides das bolas Verde e Vermelha
   */
  track(videoElement) {
    if (!this.enabled || !videoElement || videoElement.readyState < 2) {
      return this.barState;
    }

    const vw = videoElement.videoWidth || 640;
    const vh = videoElement.videoHeight || 480;

    // Resolução otimizada para detecção sem travar GC/RAM
    const procW = Math.max(160, Math.floor(vw * this.downscaleFactor));
    const procH = Math.max(120, Math.floor(vh * this.downscaleFactor));

    if (this.processCanvas.width !== procW || this.processCanvas.height !== procH) {
      this.processCanvas.width = procW;
      this.processCanvas.height = procH;
    }

    // Desenha o vídeo no canvas de processamento
    this.processCtx.drawImage(videoElement, 0, 0, procW, procH);
    const frameData = this.processCtx.getImageData(0, 0, procW, procH);
    const data = frameData.data;

    let greenSumX = 0, greenSumY = 0, greenCount = 0;
    let redSumX = 0, redSumY = 0, redCount = 0;

    const gRange = this.colorRanges.green;
    const rRange = this.colorRanges.red;

    // Amostragem com salto de 2 pixels para dobrar a performance em máquinas modestas
    const step = 2;
    for (let y = 0; y < procH; y += step) {
      const rowOffset = y * procW * 4;
      for (let x = 0; x < procW; x += step) {
        const idx = rowOffset + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Filtro rápido RGB preliminar antes do HSV para economizar CPU
        const isPotentialGreen = g > 40 && g > r * 1.1 && g > b * 1.05;
        const isPotentialRed = r > 50 && r > g * 1.25 && r > b * 1.25;

        if (!isPotentialGreen && !isPotentialRed) continue;

        const hsv = this.rgbToHsv(r, g, b);

        // Checagem Verde
        if (
          isPotentialGreen &&
          hsv.h >= gRange.hMin &&
          hsv.h <= gRange.hMax &&
          hsv.s >= gRange.sMin &&
          hsv.v >= gRange.vMin
        ) {
          greenSumX += x;
          greenSumY += y;
          greenCount++;
        }
        // Checagem Vermelho
        else if (
          isPotentialRed &&
          ((hsv.h >= rRange.hMin1 && hsv.h <= rRange.hMax1) ||
           (hsv.h >= rRange.hMin2 && hsv.h <= rRange.hMax2)) &&
          hsv.s >= rRange.sMin &&
          hsv.v >= rRange.vMin
        ) {
          redSumX += x;
          redSumY += y;
          redCount++;
        }
      }
    }

    // Limiar mínimo de pixels para considerar uma detecção válida (evita falso positivo)
    const minPixelThreshold = 8;

    let rawGreen = null;
    let rawRed = null;

    if (greenCount >= minPixelThreshold) {
      rawGreen = {
        x: (greenSumX / greenCount) / procW,
        y: (greenSumY / greenCount) / procH,
        count: greenCount
      };
    }

    if (redCount >= minPixelThreshold) {
      rawRed = {
        x: (redSumX / redCount) / procW,
        y: (redSumY / redCount) / procH,
        count: redCount
      };
    }

    // Aplicação de Filtro de Suavização Temporal (EMA)
    this.smoothGreen = this.applySmoothing(rawGreen, this.smoothGreen);
    this.smoothRed = this.applySmoothing(rawRed, this.smoothRed);

    // Atualiza estado da barra
    const hasGreen = this.smoothGreen !== null;
    const hasRed = this.smoothRed !== null;
    const detected = hasGreen || hasRed;

    let tiltAngle = 0;
    let center = null;
    let barLength = 0;
    let isLevel = true;

    if (hasGreen && hasRed) {
      const dx = this.smoothRed.x - this.smoothGreen.x;
      const dy = this.smoothRed.y - this.smoothGreen.y;
      tiltAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      
      center = {
        x: (this.smoothGreen.x + this.smoothRed.x) / 2,
        y: (this.smoothGreen.y + this.smoothRed.y) / 2
      };

      barLength = Math.sqrt(dx * dx + dy * dy);

      // Barra considerada nivelada se a inclinação for menor que 12 graus
      isLevel = Math.abs(tiltAngle) < 12 || Math.abs(Math.abs(tiltAngle) - 180) < 12;
    } else if (hasGreen) {
      center = { x: this.smoothGreen.x, y: this.smoothGreen.y };
    } else if (hasRed) {
      center = { x: this.smoothRed.x, y: this.smoothRed.y };
    }

    this.barState = {
      detected,
      hasGreen,
      hasRed,
      greenPos: this.smoothGreen,
      redPos: this.smoothRed,
      tiltAngle: Math.round(tiltAngle * 10) / 10,
      center,
      barLength,
      isLevel
    };

    return this.barState;
  }

  applySmoothing(current, previous) {
    if (!current) {
      if (previous && previous.lostFrames !== undefined) {
        previous.lostFrames++;
        if (previous.lostFrames > 5) return null;
        return previous;
      }
      return null;
    }

    if (!previous) {
      return { ...current, lostFrames: 0 };
    }

    const a = this.smoothingAlpha;
    return {
      x: previous.x * (1 - a) + current.x * a,
      y: previous.y * (1 - a) + current.y * a,
      count: current.count,
      lostFrames: 0
    };
  }

  /**
   * Atualiza as faixas de detecção de cor
   */
  setColorRange(colorName, newRange) {
    if (this.colorRanges[colorName]) {
      this.colorRanges[colorName] = { ...this.colorRanges[colorName], ...newRange };
    }
  }
}


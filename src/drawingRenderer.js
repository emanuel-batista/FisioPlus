import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateKeyJointAngles } from "./vectorMath.js";

/**
 * Renderizador de Canvas Neon & Cyberpunk para Estande de Eventos.
 * Otimizado para 60 FPS, desenha esqueleto, barra física colorida e feedback de repetição.
 */

const GAMING_COLORS = {
  connector: "#00f2fe",
  connectorGlow: "#4facfe",
  vectorArrow: "#00ff88",
  landmarkPoint: "#ff007f",
  greenMarker: "#00ff66",
  redMarker: "#ff1744",
  barLine: "#ffe600",
  barLineWarning: "#ff0055",
  jointTextBg: "rgba(10, 14, 26, 0.85)",
  jointTextBorder: "#00f2fe",
  jointTextFg: "#ffffff"
};

/**
 * Desenha a barra física com os marcadores de cor Verde e Vermelho
 */
function drawPhysicalBar(ctx, barState, bounds) {
  if (!barState || !barState.detected) return;

  const { offsetX, offsetY, drawWidth, drawHeight } = bounds;
  const toX = (normX) => offsetX + normX * drawWidth;
  const toY = (normY) => offsetY + normY * drawHeight;

  ctx.save();

  // Linha conectando as duas extremidades da barra
  if (barState.greenPos && barState.redPos) {
    const gX = toX(barState.greenPos.x);
    const gY = toY(barState.greenPos.y);
    const rX = toX(barState.redPos.x);
    const rY = toY(barState.redPos.y);

    const lineColor = barState.isLevel ? GAMING_COLORS.barLine : GAMING_COLORS.barLineWarning;

    // Laser da Barra
    ctx.strokeStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(gX, gY);
    ctx.lineTo(rX, rY);
    ctx.stroke();

    // Texto de Inclinação / Nível no centro da barra
    if (barState.center) {
      const cX = toX(barState.center.x);
      const cY = toY(barState.center.y) - 15;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = lineColor;
      ctx.shadowBlur = 6;
      const tiltText = barState.isLevel ? "BARRA NIVELADA ✓" : `INCLINAÇÃO: ${Math.abs(barState.tiltAngle)}° ⚠️`;
      ctx.fillText(tiltText, cX, cY);
    }
  }

  // Marcador Verde
  if (barState.greenPos) {
    const gx = toX(barState.greenPos.x);
    const gy = toY(barState.greenPos.y);

    ctx.beginPath();
    ctx.arc(gx, gy, 14, 0, 2 * Math.PI);
    ctx.fillStyle = GAMING_COLORS.greenMarker;
    ctx.shadowColor = GAMING_COLORS.greenMarker;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("VERDE", gx, gy + 26);
  }

  // Marcador Vermelho
  if (barState.redPos) {
    const rx = toX(barState.redPos.x);
    const ry = toY(barState.redPos.y);

    ctx.beginPath();
    ctx.arc(rx, ry, 14, 0, 2 * Math.PI);
    ctx.fillStyle = GAMING_COLORS.redMarker;
    ctx.shadowColor = GAMING_COLORS.redMarker;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("VERMELHO", rx, ry + 26);
  }

  ctx.restore();
}

/**
 * Desenha barra vertical de progresso de repetição no canto do canvas
 */
function drawRepProgressBar(ctx, progress, bounds) {
  const { offsetX, offsetY, drawWidth, drawHeight } = bounds;
  const barWidth = 14;
  const barHeight = Math.min(220, drawHeight * 0.45);
  const startX = offsetX + drawWidth - 28;
  const startY = offsetY + (drawHeight - barHeight) / 2;

  ctx.save();
  // Fundo
  ctx.fillStyle = "rgba(10, 14, 26, 0.7)";
  ctx.strokeStyle = "#00f2fe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(startX, startY, barWidth, barHeight, 7);
  ctx.fill();
  ctx.stroke();

  // Preenchimento de baixo para cima
  const fillHeight = (progress / 100) * barHeight;
  const fillY = startY + barHeight - fillHeight;
  const fillColor = progress > 80 ? "#00ff88" : progress > 40 ? "#00f2fe" : "#ff007f";

  ctx.fillStyle = fillColor;
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(startX + 2, fillY + 2, barWidth - 4, fillHeight - 4, 5);
  ctx.fill();

  // Rótulo
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 0;
  ctx.fillText(`${progress}%`, startX + barWidth / 2, startY + barHeight + 16);
  ctx.fillText("FLEXÃO", startX + barWidth / 2, startY - 8);

  ctx.restore();
}

/**
 * Renderiza o esqueleto de pose e dados biométricos
 */
export function drawPoseResults(ctx, landmarks, options = {}) {
  const {
    showConnectors = true,
    showAngles = true,
    showLandmarkIds = false,
    use3D = false,
    barState = null,
    repProgress = 0,
    floatingMessages = [],
    bounds = null
  } = options;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const renderBounds = bounds || {
    offsetX: 0,
    offsetY: 0,
    drawWidth: width,
    drawHeight: height
  };

  const { offsetX, offsetY, drawWidth, drawHeight } = renderBounds;
  const toX = (normX) => offsetX + normX * drawWidth;
  const toY = (normY) => offsetY + normY * drawHeight;

  // 1. Desenha os Marcadores da Barra Física
  if (barState && barState.detected) {
    drawPhysicalBar(ctx, barState, renderBounds);
  }

  // 2. Conexões do Esqueleto MediaPipe
  if (landmarks && landmarks.length > 0) {
    if (showConnectors && PoseLandmarker.POSE_CONNECTIONS) {
      ctx.save();
      ctx.strokeStyle = GAMING_COLORS.connector;
      ctx.shadowColor = GAMING_COLORS.connectorGlow;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";

      for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
        const p1 = landmarks[connection.start];
        const p2 = landmarks[connection.end];

        if (p1 && p2 && (p1.visibility ?? 1) > 0.3 && (p2.visibility ?? 1) > 0.3) {
          ctx.beginPath();
          ctx.moveTo(toX(p1.x), toY(p1.y));
          ctx.lineTo(toX(p2.x), toY(p2.y));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3. Pontos Articulados Principais (Ombros, Cotovelos, Pulsos, Quadril)
    ctx.save();
    const keyIndices = [11, 12, 13, 14, 15, 16, 23, 24];
    for (const idx of keyIndices) {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility ?? 1) < 0.25) continue;

      const cx = toX(lm.x);
      const cy = toY(lm.y);

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = GAMING_COLORS.landmarkPoint;
      ctx.shadowColor = GAMING_COLORS.landmarkPoint;
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (showLandmarkIds) {
        ctx.fillStyle = "#00f2fe";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(idx.toString(), cx + 8, cy + 4);
      }
    }
    ctx.restore();

    // 4. Ângulos de Flexão de Cotovelo
    if (showAngles) {
      const keyAngles = calculateKeyJointAngles(landmarks, use3D, barState);
      if (keyAngles) {
        const elbowDisplays = [
          { val: keyAngles.leftElbow, idx: 13, label: "Cotovelo E: " },
          { val: keyAngles.rightElbow, idx: 14, label: "Cotovelo D: " }
        ];

        ctx.save();
        ctx.font = "bold 13px sans-serif";

        for (const item of elbowDisplays) {
          const lm = landmarks[item.idx];
          if (lm && (lm.visibility ?? 1) > 0.3 && item.val > 0) {
            const px = toX(lm.x);
            const py = toY(lm.y);
            const text = `${item.label}${item.val}°`;
            const textWidth = ctx.measureText(text).width;

            // Card estilizado
            ctx.fillStyle = GAMING_COLORS.jointTextBg;
            ctx.beginPath();
            ctx.roundRect(px + 10, py - 18, textWidth + 14, 24, 6);
            ctx.fill();

            const borderColor = item.val < 80 ? "#00ff88" : "#00f2fe";
            ctx.strokeStyle = borderColor;
            ctx.shadowColor = borderColor;
            ctx.shadowBlur = 6;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = GAMING_COLORS.jointTextFg;
            ctx.shadowBlur = 0;
            ctx.fillText(text, px + 17, py - 2);
          }
        }
        ctx.restore();
      }
    }
  }

  // 5. Barra Dinâmica de Progresso da Flexão
  if (repProgress > 0) {
    drawRepProgressBar(ctx, repProgress, renderBounds);
  }

  // 6. Mensagens Flutuantes Gamificadas
  if (floatingMessages && floatingMessages.length > 0) {
    ctx.save();
    for (const msg of floatingMessages) {
      const centerX = width / 2;
      const centerY = height * 0.38 - msg.yOffset;

      ctx.font = `900 ${Math.round(28 * msg.scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = msg.color;
      ctx.shadowColor = msg.color;
      ctx.shadowBlur = 14;
      ctx.globalAlpha = msg.opacity;

      ctx.strokeStyle = "#0a0e1a";
      ctx.lineWidth = 4;
      ctx.strokeText(msg.text, centerX, centerY);
      ctx.fillText(msg.text, centerX, centerY);
    }
    ctx.restore();
  }
}

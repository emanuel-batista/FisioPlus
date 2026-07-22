import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateKeyJointAngles } from "./vectorMath.js";

/**
 * Renderizador de Canvas Gamificado & Maximalista para Estande de Eventos.
 * Suporta esqueletos glowing neon, vetores laser direcionais, indicadores de ângulo e mensagens flutuantes.
 * Mapeia coordenadas respeitando a proporção de aspecto (Aspect Ratio) sem esticar o vídeo.
 */

const GAMING_COLORS = {
  connector: "#00f2fe",         // Cyan Neon Brilhante
  connectorGlow: "#4facfe",     // Brilho Cyan
  vectorArrow: "#00ff88",       // Verde Neon Laser
  landmarkPoint: "#ff007f",     // Rosa Neon Choque
  landmarkGlow: "#ff007f",      // Brilho Rosa
  jointTextBg: "rgba(10, 14, 26, 0.85)", // Fundo escuro transparente estilo Sci-Fi
  jointTextBorder: "#00f2fe",   // Borda Cyan Neon
  jointTextFg: "#ffffff",       // Texto branco brilhante
  angleArc: "#7000ff"           // Violeta Neon
};

/**
 * Desenha uma seta glowing indicando a direção do vetor entre dois pontos
 */
function drawVectorArrow(ctx, pA, pB, bounds, color = GAMING_COLORS.vectorArrow) {
  const { offsetX, offsetY, drawWidth, drawHeight } = bounds;
  const xA = offsetX + pA.x * drawWidth;
  const yA = offsetY + pA.y * drawHeight;
  const xB = offsetX + pB.x * drawWidth;
  const yB = offsetY + pB.y * drawHeight;

  const dx = xB - xA;
  const dy = yB - yA;
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 5) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;

  // Corpo da seta
  ctx.beginPath();
  ctx.moveTo(xA, yA);
  ctx.lineTo(xB, yB);
  ctx.stroke();

  // Cabeça da seta
  const headLength = 14;
  ctx.beginPath();
  ctx.moveTo(xB, yB);
  ctx.lineTo(
    xB - headLength * Math.cos(angle - Math.PI / 6),
    yB - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    xB - headLength * Math.cos(angle + Math.PI / 6),
    yB - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Renderiza o esqueleto de pose, vetores direcionais e métricas de ângulo no canvas respeitando o enquadramento sem esticar.
 */
export function drawPoseResults(ctx, landmarks, options = {}) {
  const {
    showConnectors = true,
    showVectors = true,
    showAngles = true,
    showLandmarkIds = false,
    use3D = false,
    floatingMessages = [],
    bounds = null
  } = options;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Se bounds não for fornecido, assume tela inteira
  const renderBounds = bounds || {
    offsetX: 0,
    offsetY: 0,
    drawWidth: width,
    drawHeight: height
  };

  const { offsetX, offsetY, drawWidth, drawHeight } = renderBounds;

  if (!landmarks || landmarks.length === 0) return;

  const toX = (normX) => offsetX + normX * drawWidth;
  const toY = (normY) => offsetY + normY * drawHeight;

  // 1. Conexões do Esqueleto com Efeito Glow Cyberpunk
  if (showConnectors && PoseLandmarker.POSE_CONNECTIONS) {
    ctx.save();
    ctx.strokeStyle = GAMING_COLORS.connector;
    ctx.shadowColor = GAMING_COLORS.connectorGlow;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
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

  // 2. Vetores Direcionais (Setas Neon Laser)
  if (showVectors) {
    const vectorPairs = [
      [11, 13], [13, 15], // Braço esquerdo
      [12, 14], [14, 16], // Braço direito
      [23, 25], [25, 27], // Perna esquerda
      [24, 26], [26, 28], // Perna direita
      [11, 12], [23, 24]  // Cintura escapular e pélvica
    ];

    for (const [idxA, idxB] of vectorPairs) {
      const pA = landmarks[idxA];
      const pB = landmarks[idxB];

      if (pA && pB && (pA.visibility ?? 1) > 0.4 && (pB.visibility ?? 1) > 0.4) {
        drawVectorArrow(ctx, pA, pB, renderBounds);
      }
    }
  }

  // 3. Pontos Articulados (Landmarks Rosa Neon com Sombra Glow)
  ctx.save();
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if ((lm.visibility ?? 1) < 0.2) continue;

    const cx = toX(lm.x);
    const cy = toY(lm.y);
    const radius = Math.max(4, Math.min(9, 7 - (lm.z || 0) * 10));

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = GAMING_COLORS.landmarkPoint;
    ctx.shadowColor = GAMING_COLORS.landmarkGlow;
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rótulo numérico opcional do ID do Landmark
    if (showLandmarkIds) {
      ctx.fillStyle = "#00f2fe";
      ctx.font = "bold 12px sans-serif";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#000000";
      ctx.fillText(i.toString(), cx + 8, cy + 4);
    }
  }
  ctx.restore();

  // 4. Ângulos Articulares com Card Sci-Fi Transparente
  if (showAngles) {
    const keyAngles = calculateKeyJointAngles(landmarks, use3D);
    if (keyAngles) {
      const angleConfig = [
        { key: "leftElbow", idx: 13, label: "Cotovelo E: " },
        { key: "rightElbow", idx: 14, label: "Cotovelo D: " },
        { key: "leftKnee", idx: 25, label: "Joelho E: " },
        { key: "rightKnee", idx: 26, label: "Joelho D: " },
        { key: "leftShoulder", idx: 11, label: "Ombro E: " },
        { key: "rightShoulder", idx: 12, label: "Ombro D: " }
      ];

      ctx.save();
      ctx.font = "bold 13px sans-serif";

      for (const item of angleConfig) {
        const angleVal = keyAngles[item.key];
        const lm = landmarks[item.idx];

        if (lm && (lm.visibility ?? 1) > 0.4 && angleVal > 0) {
          const px = toX(lm.x);
          const py = toY(lm.y);
          const text = `${item.label}${angleVal}°`;
          const textWidth = ctx.measureText(text).width;

          // Card estilizado Sci-Fi
          ctx.fillStyle = GAMING_COLORS.jointTextBg;
          ctx.beginPath();
          ctx.roundRect(px + 10, py - 18, textWidth + 14, 24, 6);
          ctx.fill();

          ctx.strokeStyle = GAMING_COLORS.jointTextBorder;
          ctx.shadowColor = GAMING_COLORS.jointTextBorder;
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

  // 5. Renderizar Mensagens Flutuantes Gamificadas sobre o Canvas
  if (floatingMessages && floatingMessages.length > 0) {
    ctx.save();
    for (const msg of floatingMessages) {
      const centerX = width / 2;
      const centerY = height * 0.4 - msg.yOffset;

      ctx.font = `900 ${Math.round(28 * msg.scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = msg.color;
      ctx.shadowColor = msg.color;
      ctx.shadowBlur = 15;
      ctx.globalAlpha = msg.opacity;

      ctx.strokeStyle = "#0a0e1a";
      ctx.lineWidth = 4;
      ctx.strokeText(msg.text, centerX, centerY);
      ctx.fillText(msg.text, centerX, centerY);
    }
    ctx.restore();
  }
}

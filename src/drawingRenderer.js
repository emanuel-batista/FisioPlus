import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateKeyJointAngles } from "./vectorMath.js";

/**
 * Renderizador de Canvas com Foco em Alta Acessibilidade e Cores Sólidas de Alto Contraste.
 */

// Paleta de Cores Sólidas de Alto Contraste (Acessibilidade WCAG)
const HIGH_CONTRAST_COLORS = {
  connector: "#FFFFFF",        // Linha branca sólida espessa
  vectorArrow: "#00E5FF",      // Cyan sólido para vetores direcionais
  landmarkPoint: "#FFE600",    // Amarelo sólido para pontos de articulação
  jointTextBg: "#000000",      // Fundo preto para texto (contraste máximo)
  jointTextFg: "#FFFFFF",      // Texto branco sólido
  angleArc: "#00FF66"          // Verde-lima sólido para arcos de ângulo
};

/**
 * Desenha uma seta indicando a direção do vetor entre dois pontos
 */
function drawVectorArrow(ctx, pA, pB, width, height, color = HIGH_CONTRAST_COLORS.vectorArrow) {
  const xA = pA.x * width;
  const yA = pA.y * height;
  const xB = pB.x * width;
  const yB = pB.y * height;

  const dx = xB - xA;
  const dy = yB - yA;
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 5) return; // Não desenha vetores insignificantes

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  // Corpo da seta
  ctx.beginPath();
  ctx.moveTo(xA, yA);
  ctx.lineTo(xB, yB);
  ctx.stroke();

  // Cabeça da seta
  const headLength = 12;
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
 * Renderiza o esqueleto de pose, vetores direcionais e métricas de ângulo no canvas.
 */
export function drawPoseResults(ctx, landmarks, options = {}) {
  const {
    showConnectors = true,
    showVectors = true,
    showAngles = true,
    showLandmarkIds = false,
    use3D = false
  } = options;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (!landmarks || landmarks.length === 0) return;

  // 1. Desenhar Conexões do Esqueleto (Linhas Sólidas de Alto Contraste)
  if (showConnectors && PoseLandmarker.POSE_CONNECTIONS) {
    ctx.save();
    ctx.strokeStyle = HIGH_CONTRAST_COLORS.connector;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
      const p1 = landmarks[connection.start];
      const p2 = landmarks[connection.end];

      if (p1 && p2 && (p1.visibility ?? 1) > 0.3 && (p2.visibility ?? 1) > 0.3) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2. Desenhar Vetores Direcionais Chave (Ombro->Cotovelo, Cotovelo->Pulso, Quadril->Joelho, Joelho->Tornozelo)
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
        drawVectorArrow(ctx, pA, pB, width, height);
      }
    }
  }

  // 3. Desenhar Pontos de Landmarks (Círculos Amarelos Sólidos com Borda Preta)
  ctx.save();
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if ((lm.visibility ?? 1) < 0.2) continue;

    const cx = lm.x * width;
    const cy = lm.y * height;
    const radius = Math.max(3, Math.min(8, 6 - (lm.z || 0) * 10));

    // Desenha círculo interno amarelo
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = HIGH_CONTRAST_COLORS.landmarkPoint;
    ctx.fill();

    // Borda preta sólida para contraste perfeito
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rótulo numérico opcional do ID do Landmark
    if (showLandmarkIds) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px sans-serif";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(i.toString(), cx + 8, cy + 4);
      ctx.fillText(i.toString(), cx + 8, cy + 4);
    }
  }
  ctx.restore();

  // 4. Desenhar Ângulos Articulares com Rótulos de Alta Visibilidade
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
      ctx.font = "bold 14px sans-serif";

      for (const item of angleConfig) {
        const angleVal = keyAngles[item.key];
        const lm = landmarks[item.idx];

        if (lm && (lm.visibility ?? 1) > 0.4 && angleVal > 0) {
          const px = lm.x * width;
          const py = lm.y * height;
          const text = `${item.label}${angleVal}°`;
          const textWidth = ctx.measureText(text).width;

          // Caixa de Fundo Preta Sólida para garantir legibilidade (Acessibilidade)
          ctx.fillStyle = HIGH_CONTRAST_COLORS.jointTextBg;
          ctx.fillRect(px + 10, py - 18, textWidth + 12, 24);

          // Borda amarela sólida
          ctx.strokeStyle = HIGH_CONTRAST_COLORS.landmarkPoint;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 10, py - 18, textWidth + 12, 24);

          // Texto Branco Sólido
          ctx.fillStyle = HIGH_CONTRAST_COLORS.jointTextFg;
          ctx.fillText(text, px + 16, py - 1);
        }
      }
      ctx.restore();
    }
  }
}

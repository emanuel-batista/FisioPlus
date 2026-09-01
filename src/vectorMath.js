/**
 * Módulo de cálculos vetoriais e de ângulos anatômicos para MediaPipe Pose Landmarks e Marcadores da Barra.
 */

// Nomes dos 33 landmarks do MediaPipe Pose
export const LANDMARK_NAMES = [
  "0: Nariz",
  "1: Olho Esquerdo (Interno)",
  "2: Olho Esquerdo",
  "3: Olho Esquerdo (Externo)",
  "4: Olho Direito (Interno)",
  "5: Olho Direito",
  "6: Olho Direito (Externo)",
  "7: Orelha Esquerda",
  "8: Orelha Direita",
  "9: Boca (Esquerda)",
  "10: Boca (Direita)",
  "11: Ombro Esquerdo",
  "12: Ombro Direito",
  "13: Cotovelo Esquerdo",
  "14: Cotovelo Direito",
  "15: Pulso Esquerdo",
  "16: Pulso Direito",
  "17: Dedinho Esquerdo",
  "18: Dedinho Direito",
  "19: Indicador Esquerdo",
  "20: Indicador Direito",
  "21: Polegar Esquerdo",
  "22: Polegar Direito",
  "23: Quadril Esquerdo",
  "24: Quadril Direito",
  "25: Joelho Esquerdo",
  "26: Joelho Direito",
  "27: Tornozelo Esquerdo",
  "28: Tornozelo Direito",
  "29: Calcanhar Esquerdo",
  "30: Calcanhar Direito",
  "31: Pé Esquerdo (Ponta)",
  "32: Pé Direito (Ponta)"
];

/**
 * Calcula o vetor direcional de A para B: V_ab = B - A
 */
export function calculateVector(pA, pB, is3D = false) {
  if (!pA || !pB) return { x: 0, y: 0, z: 0 };
  return {
    x: pB.x - pA.x,
    y: pB.y - pA.y,
    z: is3D ? ((pB.z || 0) - (pA.z || 0)) : 0
  };
}

/**
 * Calcula o comprimento (magnitude) de um vetor
 */
export function vectorMagnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + (v.z || 0) * (v.z || 0));
}

/**
 * Normaliza um vetor
 */
export function normalizeVector(v) {
  const mag = vectorMagnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: (v.z || 0) / mag
  };
}

/**
 * Calcula o ângulo em graus no vértice B formado pelos pontos A -> B -> C.
 * Ex: A = Ombro, B = Cotovelo (vértice), C = Pulso ou Marcador de Cor da Barra.
 */
export function calculateAngle(pA, pB, pC, is3D = false) {
  if (!pA || !pB || !pC) return 0;

  const vBA = calculateVector(pB, pA, is3D);
  const vBC = calculateVector(pB, pC, is3D);

  const dotProduct = vBA.x * vBC.x + vBA.y * vBC.y + (is3D ? vBA.z * vBC.z : 0);
  const magBA = vectorMagnitude(vBA);
  const magBC = vectorMagnitude(vBC);

  if (magBA === 0 || magBC === 0) return 0;

  let cosAngle = dotProduct / (magBA * magBC);
  cosAngle = Math.max(-1, Math.min(1, cosAngle));

  const angleRad = Math.acos(cosAngle);
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Calcula os ângulos articulares principais, integrando os marcadores da barra quando presentes
 */
export function calculateKeyJointAngles(landmarks, is3D = false, barState = null) {
  if (!landmarks || landmarks.length < 33) return null;

  // Pontos de referência corporais
  const shoulderL = landmarks[11];
  const shoulderR = landmarks[12];
  const elbowL = landmarks[13];
  const elbowR = landmarks[14];
  let wristL = landmarks[15];
  let wristR = landmarks[16];

  // Se a barra estiver detectada com os marcadores de cor, funde os pontos para máxima precisão
  if (barState && barState.detected) {
    if (barState.greenPos && barState.redPos) {
      // Determina qual bola está mais próxima do lado esquerdo/direito do usuário
      if (barState.greenPos.x < barState.redPos.x) {
        // Verde à esquerda da imagem (braço direito da pessoa em modo espelho)
        wristL = barState.redPos;
        wristR = barState.greenPos;
      } else {
        wristL = barState.greenPos;
        wristR = barState.redPos;
      }
    }
  }

  const leftElbow = calculateAngle(shoulderL, elbowL, wristL, is3D);
  const rightElbow = calculateAngle(shoulderR, elbowR, wristR, is3D);

  // Média dos dois cotovelos para flexão bimanual com barra
  const avgElbow = (leftElbow > 0 && rightElbow > 0)
    ? Math.round(((leftElbow + rightElbow) / 2) * 10) / 10
    : (leftElbow || rightElbow || 0);

  // Diferença de amplitude entre os dois braços (Simetria)
  const elbowDiff = (leftElbow > 0 && rightElbow > 0)
    ? Math.abs(leftElbow - rightElbow)
    : 0;

  return {
    leftElbow,
    rightElbow,
    avgElbow,
    elbowDiff,
    leftKnee: calculateAngle(landmarks[23], landmarks[25], landmarks[27], is3D),
    rightKnee: calculateAngle(landmarks[24], landmarks[26], landmarks[28], is3D),
    leftShoulder: calculateAngle(landmarks[23], landmarks[11], landmarks[13], is3D),
    rightShoulder: calculateAngle(landmarks[24], landmarks[12], landmarks[14], is3D)
  };
}

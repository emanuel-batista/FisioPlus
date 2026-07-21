/**
 * Módulo de cálculos vetoriais e de ângulos anatômicos para MediaPipe Pose Landmarks.
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
  const vec = {
    x: pB.x - pA.x,
    y: pB.y - pA.y,
    z: is3D ? (pB.z - pA.z) : 0
  };
  return vec;
}

/**
 * Calcula o comprimento (magnitude) de um vetor
 */
export function vectorMagnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + (v.z || 0) * (v.z || 0));
}

/**
 * Normaliza um vetor (transforma em vetor unitário)
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
 * Ex: A = Ombro, B = Cotovelo (vértice), C = Pulso.
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
  // Limita o valor entre -1 e 1 para evitar NaN devido a imprecisão de ponto flutuante
  cosAngle = Math.max(-1, Math.min(1, cosAngle));

  const angleRad = Math.acos(cosAngle);
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Retorna os ângulos articulares chave para análise postural e biomecânica.
 */
export function calculateKeyJointAngles(landmarks, is3D = false) {
  if (!landmarks || landmarks.length < 33) return null;

  return {
    leftElbow: calculateAngle(landmarks[11], landmarks[13], landmarks[15], is3D),   // Ombro, Cotovelo, Pulso Esquerdo
    rightElbow: calculateAngle(landmarks[12], landmarks[14], landmarks[16], is3D),  // Ombro, Cotovelo, Pulso Direito
    leftKnee: calculateAngle(landmarks[23], landmarks[25], landmarks[27], is3D),    // Quadril, Joelho, Tornozelo Esquerdo
    rightKnee: calculateAngle(landmarks[24], landmarks[26], landmarks[28], is3D),   // Quadril, Joelho, Tornozelo Direito
    leftShoulder: calculateAngle(landmarks[23], landmarks[11], landmarks[13], is3D),// Quadril, Ombro, Cotovelo Esquerdo
    rightShoulder: calculateAngle(landmarks[24], landmarks[12], landmarks[14], is3D)// Quadril, Ombro, Cotovelo Direito
  };
}

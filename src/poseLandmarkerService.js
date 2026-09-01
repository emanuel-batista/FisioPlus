import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * Serviço responsável por carregar o WASM e instanciar o PoseLandmarker do MediaPipe.
 * Otimizado para máquinas com 8GB de RAM e Webcams de entrada utilizando o modelo Lite.
 */
export class PoseLandmarkerService {
  constructor() {
    this.poseLandmarker = null;
    this.runningMode = "VIDEO";
    this.isReady = false;
  }

  /**
   * Inicializa o detector com o modelo pose_landmarker_lite.task local.
   */
  async initialize(customOptions = {}) {
    this.isReady = false;

    // Carrega binários do WASM da CDN
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );

    // Usa o modelo Lite como padrão (5.7 MB vs 30.6 MB do Heavy) para máxima fluidez a 60 FPS
    const modelPath = customOptions.modelPath || "/pose_landmarker_lite.task";
    this.runningMode = customOptions.runningMode || "VIDEO";

    const baseConfig = {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numPoses: 1, // 1 pessoa por vez no estande economiza muita CPU/RAM
      minPoseDetectionConfidence: customOptions.minDetectionConfidence || 0.4,
      minPosePresenceConfidence: customOptions.minPresenceConfidence || 0.4,
      minTrackingConfidence: customOptions.minTrackingConfidence || 0.4,
      outputSegmentationMasks: false
    };

    try {
      // Tenta criar com aceleração por GPU
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, baseConfig);
    } catch (gpuError) {
      console.warn("GPU delegate não suportado ou instável, iniciando com CPU...", gpuError);
      baseConfig.baseOptions.delegate = "CPU";
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, baseConfig);
    }

    this.isReady = true;
    return this.poseLandmarker;
  }

  /**
   * Altera o modo de execução entre "VIDEO" (Webcam/Vídeo) e "IMAGE" (Foto estática)
   */
  async setRunningMode(mode) {
    if (!this.poseLandmarker) return;
    if (this.runningMode === mode) return;

    this.runningMode = mode;
    await this.poseLandmarker.setOptions({ runningMode: mode });
  }

  /**
   * Atualiza limiares de confiança em tempo real
   */
  async updateOptions(options) {
    if (!this.poseLandmarker) return;
    await this.poseLandmarker.setOptions(options);
  }

  /**
   * Executa a detecção para um frame de vídeo/webcam em determinado timestamp
   */
  detectForVideo(videoElement, timestamp) {
    if (!this.poseLandmarker || !this.isReady) return null;
    return this.poseLandmarker.detectForVideo(videoElement, timestamp);
  }

  /**
   * Executa a detecção para uma imagem estática
   */
  detectImage(imageElement) {
    if (!this.poseLandmarker || !this.isReady) return null;
    return this.poseLandmarker.detect(imageElement);
  }
}

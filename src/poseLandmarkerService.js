import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/**
 * Serviço responsável por carregar o WASM e instanciar o PoseLandmarker do MediaPipe.
 */
export class PoseLandmarkerService {
  constructor() {
    this.poseLandmarker = null;
    this.runningMode = "VIDEO";
    this.isReady = false;
  }

  /**
   * Inicializa o detector com o modelo pose_landmarker_heavy.task local.
   */
  async initialize(customOptions = {}) {
    this.isReady = false;

    // Carrega binários do WASM da CDN ou assets
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );

    const modelPath = customOptions.modelPath || "/pose_landmarker_heavy.task";
    this.runningMode = customOptions.runningMode || "VIDEO";

    const baseConfig = {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numPoses: customOptions.numPoses || 1,
      minPoseDetectionConfidence: customOptions.minDetectionConfidence || 0.5,
      minPosePresenceConfidence: customOptions.minPresenceConfidence || 0.5,
      minTrackingConfidence: customOptions.minTrackingConfidence || 0.5,
      outputSegmentationMasks: false
    };

    try {
      // Tenta criar com aceleração por GPU
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, baseConfig);
    } catch (gpuError) {
      console.warn("Falha ao inicializar com GPU, tentando com CPU...", gpuError);
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

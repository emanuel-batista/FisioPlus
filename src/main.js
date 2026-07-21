import { PoseLandmarkerService } from "./poseLandmarkerService.js";
import { drawPoseResults } from "./drawingRenderer.js";
import { LANDMARK_NAMES } from "./vectorMath.js";

// Instâncias Globais da Aplicação
const poseService = new PoseLandmarkerService();

// Elementos do DOM
const modelStatusEl = document.getElementById("model-status");
const fpsCounterEl = document.getElementById("fps-counter");
const webcamVideo = document.getElementById("webcam-video");
const staticImage = document.getElementById("static-image");
const outputCanvas = document.getElementById("output-canvas");
const canvasCtx = outputCanvas.getContext("2d");
const overlayMsg = document.getElementById("canvas-overlay-msg");
const overlayText = document.getElementById("overlay-text");

const btnTogglePlay = document.getElementById("btn-toggle-play");
const videoUploadInput = document.getElementById("video-upload");
const imageUploadInput = document.getElementById("image-upload");

const sourceModeSelect = document.getElementById("source-mode-select");
const cameraSelect = document.getElementById("camera-select");
const cameraWarning = document.getElementById("camera-warning");

const chkConnectors = document.getElementById("chk-connectors");
const chkVectors = document.getElementById("chk-vectors");
const chkAngles = document.getElementById("chk-angles");
const chkIds = document.getElementById("chk-ids");
const chk3D = document.getElementById("chk-3d");

const landmarksTbody = document.getElementById("landmarks-tbody");

// Estado do Player & FPS
let isRunning = false;
let animationFrameId = null;
let lastFrameTime = 0;
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentSourceMode = "webcam"; // "webcam" | "video" | "image"
let activeStream = null;

/**
 * Inicialização do App ao carregar o DOM
 */
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  initTableRows();
  await checkCameraAvailability();
  await loadMediaPipeModel();
});

/**
 * Preenche a tabela com as 33 linhas de landmarks
 */
function initTableRows() {
  landmarksTbody.innerHTML = "";
  for (let i = 0; i < 33; i++) {
    const tr = document.createElement("tr");
    tr.id = `lm-row-${i}`;
    tr.innerHTML = `
      <td><strong>${LANDMARK_NAMES[i]}</strong></td>
      <td id="lm-${i}-x">-</td>
      <td id="lm-${i}-y">-</td>
      <td id="lm-${i}-z">-</td>
      <td id="lm-${i}-v">-</td>
    `;
    landmarksTbody.appendChild(tr);
  }
}

/**
 * Atualiza a tabela de coordenadas dos 33 landmarks em tempo real
 */
function updateLandmarksTable(landmarks) {
  if (!landmarks || landmarks.length === 0) return;

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const xEl = document.getElementById(`lm-${i}-x`);
    const yEl = document.getElementById(`lm-${i}-y`);
    const zEl = document.getElementById(`lm-${i}-z`);
    const vEl = document.getElementById(`lm-${i}-v`);

    if (xEl) xEl.textContent = lm.x.toFixed(3);
    if (yEl) yEl.textContent = lm.y.toFixed(3);
    if (zEl) zEl.textContent = lm.z.toFixed(3);
    if (vEl) vEl.textContent = ((lm.visibility ?? 1) * 100).toFixed(0) + "%";
  }
}

/**
 * Carrega o modelo MediaPipe PoseLandmarker
 */
async function loadMediaPipeModel() {
  try {
    modelStatusEl.textContent = "Carregando modelo MediaPipe...";
    modelStatusEl.className = "status-badge status-loading";

    await poseService.initialize({
      modelPath: "/pose_landmarker_heavy.task",
      runningMode: "VIDEO"
    });

    modelStatusEl.textContent = "Modelo Pronto (Heavy GPU/CPU)";
    modelStatusEl.className = "status-badge status-ready";
    btnTogglePlay.disabled = false;

    // Se o modo webcam falhou por falta de câmera, sugere vídeo
    if (cameraWarning.style.display !== "none") {
      overlayText.textContent = "Modelo pronto! Nenhuma webcam detectada. Faça upload de um arquivo de vídeo para testar.";
    } else {
      overlayText.textContent = "Modelo pronto! Clique em 'Iniciar Detecção' ou selecione um arquivo de vídeo.";
    }
  } catch (error) {
    console.error("Erro ao carregar MediaPipe PoseLandmarker:", error);
    modelStatusEl.textContent = "Erro ao carregar modelo";
    modelStatusEl.className = "status-badge status-error";
    overlayText.textContent = "Falha ao inicializar o detector de pose. Verifique o arquivo pose_landmarker_heavy.task.";
  }
}

/**
 * Enumera as câmeras disponíveis
 */
async function checkCameraAvailability() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      showNoCameraState();
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");

    cameraSelect.innerHTML = "";

    if (videoDevices.length === 0) {
      showNoCameraState();
    } else {
      cameraWarning.style.display = "none";
      videoDevices.forEach((device, idx) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Câmera ${idx + 1}`;
        cameraSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.warn("Erro ao enumerar dispositivos de vídeo:", err);
    showNoCameraState();
  }
}

function showNoCameraState() {
  cameraWarning.style.display = "block";
  cameraSelect.innerHTML = `<option value="">Nenhuma câmera disponível</option>`;
  // Alterna o modo padrão para vídeo de teste
  sourceModeSelect.value = "video";
  currentSourceMode = "video";
}

/**
 * Configura os ouvintes de eventos da interface
 */
function setupEventListeners() {
  // Alteração do Modo de Operação
  sourceModeSelect.addEventListener("change", (e) => {
    currentSourceMode = e.target.value;
    stopDetection();
    
    if (currentSourceMode === "webcam") {
      overlayText.textContent = "Modo Webcam ativado. Clique em 'Iniciar Detecção'.";
    } else if (currentSourceMode === "video") {
      overlayText.textContent = "Modo Vídeo ativado. Selecione um arquivo de vídeo de teste.";
    } else if (currentSourceMode === "image") {
      overlayText.textContent = "Modo Imagem ativado. Selecione uma foto estática.";
    }
  });

  // Botão Iniciar / Pausar
  btnTogglePlay.addEventListener("click", () => {
    if (isRunning) {
      stopDetection();
    } else {
      startDetection();
    }
  });

  // Upload de Arquivo de Vídeo
  videoUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    sourceModeSelect.value = "video";
    currentSourceMode = "video";

    const videoUrl = URL.createObjectURL(file);
    webcamVideo.src = videoUrl;
    webcamVideo.loop = true;
    webcamVideo.play();

    webcamVideo.onloadedmetadata = () => {
      syncCanvasDimensions(webcamVideo.videoWidth, webcamVideo.videoHeight);
      startDetection();
    };
  });

  // Upload de Arquivo de Imagem Estática
  imageUploadInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    sourceModeSelect.value = "image";
    currentSourceMode = "image";
    stopDetection();

    const imageUrl = URL.createObjectURL(file);
    staticImage.src = imageUrl;

    staticImage.onload = async () => {
      syncCanvasDimensions(staticImage.naturalWidth, staticImage.naturalHeight);
      overlayMsg.style.display = "none";
      await poseService.setRunningMode("IMAGE");
      const results = poseService.detectImage(staticImage);
      
      if (results && results.landmarks && results.landmarks.length > 0) {
        drawFrame(results.landmarks[0]);
        updateLandmarksTable(results.landmarks[0]);
      } else {
        alert("Nenhuma pessoa foi detectada na imagem estática selecionada.");
      }
    };
  });
}

/**
 * Ajusta a resolução nativa do Canvas de acordo com a mídia
 */
function syncCanvasDimensions(w, h) {
  outputCanvas.width = w || 1280;
  outputCanvas.height = h || 720;
}

/**
 * Inicia o loop de processamento
 */
async function startDetection() {
  if (!poseService.isReady) return;

  overlayMsg.style.display = "none";

  if (currentSourceMode === "webcam") {
    await poseService.setRunningMode("VIDEO");
    try {
      const deviceId = cameraSelect.value;
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      };
      
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      webcamVideo.srcObject = activeStream;
      await webcamVideo.play();
      
      syncCanvasDimensions(webcamVideo.videoWidth, webcamVideo.videoHeight);
    } catch (err) {
      console.error("Erro ao acessar a webcam:", err);
      alert("Não foi possível acessar a webcam. Certifique-se de conectar uma câmera ou utilize o modo 'Arquivo de Vídeo'.");
      overlayMsg.style.display = "block";
      overlayText.textContent = "Erro de acesso à câmera. Selecione um arquivo de vídeo para testar.";
      return;
    }
  } else if (currentSourceMode === "video") {
    await poseService.setRunningMode("VIDEO");
    if (!webcamVideo.src) {
      alert("Por favor, selecione um arquivo de vídeo antes de iniciar.");
      return;
    }
    await webcamVideo.play();
    syncCanvasDimensions(webcamVideo.videoWidth, webcamVideo.videoHeight);
  }

  isRunning = true;
  btnTogglePlay.textContent = "⏸ Pausar Detecção";
  btnTogglePlay.className = "btn btn-secondary";
  
  lastFrameTime = performance.now();
  renderLoop();
}

/**
 * Interrompe o loop de detecção
 */
function stopDetection() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (webcamVideo.srcObject) {
    const tracks = webcamVideo.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    webcamVideo.srcObject = null;
  } else if (currentSourceMode === "video" && !webcamVideo.paused) {
    webcamVideo.pause();
  }

  btnTogglePlay.textContent = "▶ Iniciar Detecção";
  btnTogglePlay.className = "btn btn-primary";
  overlayMsg.style.display = "block";
  overlayText.textContent = "Detecção pausada.";
}

/**
 * Loop contínuo de renderização por frame (requestAnimationFrame)
 */
function renderLoop() {
  if (!isRunning) return;

  const now = performance.now();

  // Processa frame com o MediaPipe
  if (webcamVideo.currentTime !== lastFrameTime && webcamVideo.readyState >= 2) {
    lastFrameTime = webcamVideo.currentTime;
    const results = poseService.detectForVideo(webcamVideo, now);

    if (results && results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      drawFrame(landmarks);
      updateLandmarksTable(landmarks);
    } else {
      // Limpa canvas se não houver pessoa detectada
      canvasCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    }
  }

  // Cálculo de FPS
  frameCount++;
  if (now - lastFpsUpdateTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    fpsCounterEl.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFpsUpdateTime = now;
  }

  animationFrameId = requestAnimationFrame(renderLoop);
}

/**
 * Desenha o resultado do frame no canvas
 */
function drawFrame(landmarks) {
  // Limpa o canvas
  canvasCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

  // Desenha a mídia de fundo (vídeo ou imagem) no canvas para visualização perfeita
  if (currentSourceMode === "image" && staticImage.complete) {
    canvasCtx.drawImage(staticImage, 0, 0, outputCanvas.width, outputCanvas.height);
  } else if (webcamVideo.readyState >= 2) {
    canvasCtx.drawImage(webcamVideo, 0, 0, outputCanvas.width, outputCanvas.height);
  }

  // Renderiza sobreposição dos vetores e articulações
  drawPoseResults(canvasCtx, landmarks, {
    showConnectors: chkConnectors.checked,
    showVectors: chkVectors.checked,
    showAngles: chkAngles.checked,
    showLandmarkIds: chkIds.checked,
    use3D: chk3D.checked
  });
}

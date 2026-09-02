import { PoseLandmarkerService } from "./poseLandmarkerService.js";
import { ColorTracker } from "./colorTracker.js";
import { drawPoseResults } from "./drawingRenderer.js";
import { LANDMARK_NAMES, calculateKeyJointAngles } from "./vectorMath.js";
import { GameEngine } from "./gameEngine.js";
import { setupTunnelClient } from "./tunnelClient.js";
import { buildCameraConstraints } from "./cameraConfig.js";

// Instâncias Globais da Aplicação
const poseService = new PoseLandmarkerService();
const colorTracker = new ColorTracker();
const gameEngine = new GameEngine();

// Referências aos Elementos da SPA
const screens = {
  loading: document.getElementById("screen-loading"),
  start: document.getElementById("screen-start"),
  challenge: document.getElementById("screen-challenge"),
  game: document.getElementById("screen-game")
};

const modalVictory = document.getElementById("modal-victory");
const confettiCanvas = document.getElementById("confetti-canvas");
const victoryConfettiImg = document.getElementById("victory-confetti-img");

// Elementos do Banner de Cookies
const cookieBanner = document.getElementById("cookie-banner");
const btnAcceptCookies = document.getElementById("btn-accept-cookies");

// Elementos de Debug (Código 1234)
const debugBanner = document.getElementById("debug-banner");
const chkDisableAutocam = document.getElementById("chk-disable-autocam");
const btnDebugSimRep = document.getElementById("btn-debug-sim-rep");
const btnDebugSimWin = document.getElementById("btn-debug-sim-win");
const btnDebugExit = document.getElementById("btn-debug-exit");
const debugSidebarCard = document.getElementById("debug-sidebar-card");
const debugAngleVal = document.getElementById("debug-angle-val");
const debugPhaseVal = document.getElementById("debug-phase-val");
const debugBarVal = document.getElementById("debug-bar-val");

// Buffer para captura da sequência de teclas "1234"
let keySequenceBuffer = "";
let keySequenceTimer = null;

// Elementos de Carregamento
const loadingProgressBar = document.getElementById("loading-progress-bar");
const loadingStatusText = document.getElementById("loading-status-text");

// Elementos do HUD de Estande
const hudRepsCount = document.getElementById("hud-reps-count");
const hudRepsTotal = document.getElementById("hud-reps-total");
const hudAccuracyPercent = document.getElementById("hud-accuracy-percent");
const gameStatusText = document.getElementById("game-status-text");
const btnResetSession = document.getElementById("btn-reset-session");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const gameSidebar = document.getElementById("game-sidebar");
const btnCloseSidebar = document.getElementById("btn-close-sidebar");

// Botões de Navegação entre Telas
const btnGotoChallenge = document.getElementById("btn-goto-challenge");
const btnStartGame = document.getElementById("btn-start-game");
const btnNextParticipant = document.getElementById("btn-next-participant");

// Elementos do Canvas & Viewport
const webcamVideo = document.getElementById("webcam-video");
const staticImage = document.getElementById("static-image");
const outputCanvas = document.getElementById("output-canvas");
const canvasCtx = outputCanvas.getContext("2d", { alpha: false }); // Desativa canal alfa para maior velocidade de render
const canvasOverlayMsg = document.getElementById("canvas-overlay-msg");
const overlayText = document.getElementById("overlay-text");
const btnTogglePlay = document.getElementById("btn-toggle-play");
const videoUploadInput = document.getElementById("video-upload");
const imageUploadInput = document.getElementById("image-upload");

// Seletores de Configurações
const aiModelSelect = document.getElementById("ai-model-select");
const sourceModeSelect = document.getElementById("source-mode-select");
const cameraSelect = document.getElementById("camera-select");

// Checkboxes de Opções de Renderização
const chkConnectors = document.getElementById("chk-connectors");
const chkBarTracker = document.getElementById("chk-bar-tracker");
const chkAngles = document.getElementById("chk-angles");
const chkIds = document.getElementById("chk-ids");
const chk3D = document.getElementById("chk-3d");

const landmarksTbody = document.getElementById("landmarks-tbody");

// Estado do Player & Loop
let isRunning = false;
let animationFrameId = null;
let currentSourceMode = "webcam";
let activeStream = null;
let frameCounter = 0;

// Confetes Engine
let confettiParticles = [];
let confettiAnimationFrame = null;

/**
 * Utilitários de Cookies
 */
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Strict`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

let currentAiModel = getActiveModel();

/**
 * Retorna o modelo ativo com prioridade: URL (?model=...) -> ENV (VITE_POSE_MODEL) -> 'lite'
 */
function getActiveModel() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramModel = urlParams.get("model");
  if (paramModel && ["lite", "full", "heavy"].includes(paramModel.toLowerCase())) {
    return paramModel.toLowerCase();
  }
  const envModel = import.meta.env.VITE_POSE_MODEL;
  if (envModel && ["lite", "full", "heavy"].includes(envModel.toLowerCase())) {
    return envModel.toLowerCase();
  }
  return "lite";
}

// Instância Global do Túnel
let tunnelClientInstance = null;

function syncTunnelGameState() {
  if (tunnelClientInstance) {
    tunnelClientInstance.sendState({
      screen: gameEngine.currentScreen,
      reps: gameEngine.repsCount,
      target: gameEngine.isDebugMode ? '∞' : gameEngine.targetReps,
      accuracy: gameEngine.currentAccuracy,
      isDebug: gameEngine.isDebugMode,
      isRunning: isRunning,
      isAutocamDisabled: chkDisableAutocam ? chkDisableAutocam.checked : false,
      aiModel: currentAiModel,
      statusText: gameStatusText ? gameStatusText.textContent : ''
    });
  }
}

/**
 * Inicialização Principal ao carregar o DOM
 */
document.addEventListener("DOMContentLoaded", async () => {
  initCookieSystem();
  setupEventListeners();
  setupGameEngineCallbacks();
  tunnelClientInstance = setupTunnelClient();
  setupKeySequenceDetector();
  initTableRows();

  window.addEventListener("fisioplus:tunnel_connected", () => {
    syncTunnelGameState();
  });

  // Sincroniza seletor da UI com o modelo ativo
  if (aiModelSelect) {
    aiModelSelect.value = currentAiModel;
  }

  // 1. Carregamento dos modelos
  updateLoadingProgress(35, "Mapeando dispositivos de vídeo...");
  await checkCameraAvailability();

  const modelLabels = { lite: "Lite (Ultra Rápido)", full: "Full (Equilibrado)", heavy: "Heavy (Alta Precisão)" };
  updateLoadingProgress(70, `Carregando modelo ${modelLabels[currentAiModel] || currentAiModel}...`);
  await loadMediaPipeModel(currentAiModel);

  updateLoadingProgress(100, "Pronto para o evento!");
  
  // Transição para a Tela Inicial
  setTimeout(() => {
    gameEngine.setScreen('start');
    syncTunnelGameState();
  }, 500);
});

function initCookieSystem() {
  const consent = getCookie("fisioplus_cookie_consent");
  if (!consent && cookieBanner) {
    cookieBanner.style.display = "block";
  }

  const disableAutocamPref = getCookie("fisioplus_disable_autocam");
  if (disableAutocamPref === "true" && chkDisableAutocam) {
    chkDisableAutocam.checked = true;
  }
}

function updateLoadingProgress(percentage, text) {
  if (loadingProgressBar) loadingProgressBar.style.width = `${percentage}%`;
  if (loadingStatusText && text) loadingStatusText.textContent = text;
}

/**
 * Detector de Sequência de Teclas Secreta (Digitando "1234")
 */
function setupKeySequenceDetector() {
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    if (/\d/.test(e.key)) {
      keySequenceBuffer += e.key;

      if (keySequenceTimer) clearTimeout(keySequenceTimer);
      keySequenceTimer = setTimeout(() => {
        keySequenceBuffer = "";
      }, 2000);

      if (keySequenceBuffer.endsWith("1234")) {
        keySequenceBuffer = "";
        activateDebugMode();
      }
    }
  });
}

function activateDebugMode() {
  gameEngine.setDebugMode(true);
  gameEngine.resetGame();
  gameEngine.setScreen('game');

  if (gameSidebar) gameSidebar.classList.add("open");
  if (debugBanner) debugBanner.style.display = "block";
  if (debugSidebarCard) debugSidebarCard.style.display = "block";
  if (hudRepsTotal) hudRepsTotal.textContent = "/ ∞";

  if (chkDisableAutocam && chkDisableAutocam.checked) {
    if (gameStatusText) gameStatusText.textContent = "MODO DEBUG ATIVO (1234): Câmera pausada.";
  } else {
    if (gameStatusText) gameStatusText.textContent = "MODO DEBUG ATIVO (1234): Repetições Ilimitadas (∞).";
  }
  syncTunnelGameState();
}

function deactivateDebugMode() {
  gameEngine.setDebugMode(false);
  if (debugBanner) debugBanner.style.display = "none";
  if (debugSidebarCard) debugSidebarCard.style.display = "none";
  if (hudRepsTotal) hudRepsTotal.textContent = "/ 10";
  syncTunnelGameState();
}

function setupGameEngineCallbacks() {
  gameEngine.onStateChange = (screenName) => {
    Object.keys(screens).forEach(key => {
      if (key === screenName) {
        screens[key].classList.add("active");
      } else {
        screens[key].classList.remove("active");
      }
    });

    if (screenName === 'game') {
      resizeCanvas();

      const disableAutocam = chkDisableAutocam && chkDisableAutocam.checked;

      if (!isRunning && currentSourceMode === 'webcam') {
        if (disableAutocam) {
          if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
          if (overlayText) overlayText.textContent = "Câmera automática desativada (Debug). Clique em 'Iniciar Câmera'.";
        } else {
          startWebcam();
        }
      }
    }

    syncTunnelGameState();
  };

  gameEngine.onRepCount = (data) => {
    if (hudRepsCount) hudRepsCount.textContent = data.reps;
    if (hudRepsTotal) hudRepsTotal.textContent = `/ ${data.target}`;
    if (hudAccuracyPercent) hudAccuracyPercent.textContent = `${data.accuracy}%`;
    if (gameStatusText && data.stateText) gameStatusText.textContent = data.stateText;
    syncTunnelGameState();
  };

  gameEngine.onVictory = (data) => {
    if (modalVictory) {
      document.getElementById("victory-accuracy-val").textContent = `${data.accuracy}%`;
      modalVictory.classList.add("active");
      startConfetti();
    }
    syncTunnelGameState();
  };

  gameEngine.onDebugChange = (isDebug) => {
    if (debugBanner) debugBanner.style.display = isDebug ? "block" : "none";
    if (debugSidebarCard) debugSidebarCard.style.display = isDebug ? "block" : "none";
    if (hudRepsTotal) hudRepsTotal.textContent = isDebug ? "/ ∞" : "/ 10";
    syncTunnelGameState();
  };
}

function applyRemoteControlAction(action, payload = null) {
  switch (action) {
    case "startGame":
      gameEngine.startGame();
      break;
    case "resetGame":
    case "reset":
      gameEngine.resetGame();
      break;
    case "goToStart":
    case "screenStart":
    case "startScreen":
    case "home":
      gameEngine.setScreen("start");
      break;
    case "goToChallenge":
    case "challengeScreen":
    case "challenge":
      gameEngine.initAudio();
      gameEngine.setScreen("challenge");
      break;
    case "nextParticipant":
      stopConfetti();
      if (modalVictory) modalVictory.classList.remove("active");
      gameEngine.resetGame();
      gameEngine.setScreen("challenge");
      break;
    case "debug":
    case "debugOn":
      activateDebugMode();
      break;
    case "debugOff":
    case "exitDebug":
      deactivateDebugMode();
      break;
    case "debugToggle":
      if (gameEngine.isDebugMode) {
        deactivateDebugMode();
      } else {
        activateDebugMode();
      }
      break;
    case "simRep":
    case "simulateRep":
      gameEngine.simulateRepetition();
      break;
    case "simWin":
    case "simulateWin":
    case "triggerVictory":
      gameEngine.triggerVictory();
      break;
    case "addRep":
      gameEngine.adjustRepetition(1);
      break;
    case "removeRep":
      gameEngine.adjustRepetition(-1);
      break;
    case "togglePlay":
    case "play":
    case "pause":
      togglePlayPause();
      break;
    case "toggleAutocam":
      if (chkDisableAutocam) {
        chkDisableAutocam.checked = !chkDisableAutocam.checked;
        setCookie("fisioplus_disable_autocam", chkDisableAutocam.checked ? "true" : "false", 365);
      }
      break;
    case "toggleSidebar":
      if (gameSidebar) {
        gameSidebar.classList.toggle("open");
        setTimeout(resizeCanvas, 300);
      }
      break;
    case "setModelLite":
    case "setModelFull":
    case "setModelHeavy":
    case "setModel": {
      const model = action === "setModelLite" ? "lite" : action === "setModelFull" ? "full" : action === "setModelHeavy" ? "heavy" : (payload || "lite");
      if (model !== currentAiModel) {
        currentAiModel = model;
        if (aiModelSelect) aiModelSelect.value = model;
        if (gameStatusText) gameStatusText.textContent = `Carregando modelo ${model.toUpperCase()}...`;
        loadMediaPipeModel(model).then(() => {
          if (gameStatusText) gameStatusText.textContent = `Modelo ${model.toUpperCase()} carregado com sucesso!`;
          syncTunnelGameState();
        });
      }
      break;
    }
    default:
      console.warn(`Ação remota desconhecida: ${action}`);
  }
  syncTunnelGameState();
}

window.addEventListener("fisioplus:control", (event) => {
  const action = event.detail?.action;
  const payload = event.detail?.payload;
  if (action) {
    applyRemoteControlAction(action, payload);
  }
});

function setupEventListeners() {
  if (btnAcceptCookies) {
    btnAcceptCookies.addEventListener("click", () => {
      setCookie("fisioplus_cookie_consent", "true", 365);
      if (cookieBanner) cookieBanner.style.display = "none";
    });
  }

  if (chkDisableAutocam) {
    chkDisableAutocam.addEventListener("change", (e) => {
      setCookie("fisioplus_disable_autocam", e.target.checked ? "true" : "false", 365);
    });
  }

  if (btnGotoChallenge) {
    btnGotoChallenge.addEventListener("click", () => {
      gameEngine.initAudio();
      gameEngine.setScreen('challenge');
    });
  }

  if (btnStartGame) {
    btnStartGame.addEventListener("click", () => {
      gameEngine.resetGame();
      gameEngine.setScreen('game');
    });
  }

  if (btnResetSession) {
    btnResetSession.addEventListener("click", () => {
      gameEngine.resetGame();
    });
  }

  if (btnNextParticipant) {
    btnNextParticipant.addEventListener("click", () => {
      stopConfetti();
      if (modalVictory) modalVictory.classList.remove("active");
      gameEngine.resetGame();
      gameEngine.setScreen('challenge');
    });
  }

  if (btnDebugSimRep) {
    btnDebugSimRep.addEventListener("click", () => {
      gameEngine.simulateRepetition();
    });
  }

  if (btnDebugSimWin) {
    btnDebugSimWin.addEventListener("click", () => {
      gameEngine.triggerVictory();
    });
  }

  if (btnDebugExit) {
    btnDebugExit.addEventListener("click", () => {
      deactivateDebugMode();
    });
  }

  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener("click", () => {
      if (gameSidebar) {
        gameSidebar.classList.toggle("open");
        setTimeout(resizeCanvas, 300);
      }
    });
  }

  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener("click", () => {
      if (gameSidebar) {
        gameSidebar.classList.remove("open");
        setTimeout(resizeCanvas, 300);
      }
    });
  }

  if (btnTogglePlay) {
    btnTogglePlay.addEventListener("click", togglePlayPause);
  }

  if (aiModelSelect) {
    aiModelSelect.addEventListener("change", async (e) => {
      const newModel = e.target.value;
      if (newModel !== currentAiModel) {
        currentAiModel = newModel;
        if (gameStatusText) gameStatusText.textContent = `Carregando modelo ${newModel.toUpperCase()}...`;
        await loadMediaPipeModel(newModel);
        if (gameStatusText) gameStatusText.textContent = `Modelo ${newModel.toUpperCase()} carregado com sucesso!`;
      }
    });
  }

  if (sourceModeSelect) {
    sourceModeSelect.addEventListener("change", (e) => {
      changeSourceMode(e.target.value);
    });
  }

  if (videoUploadInput) {
    videoUploadInput.addEventListener("change", handleVideoUpload);
  }

  if (imageUploadInput) {
    imageUploadInput.addEventListener("change", handleImageUpload);
  }

  window.addEventListener("resize", resizeCanvas);
}

/**
 * Redimensiona o canvas apenas quando necessário (evita travamentos a 60fps)
 */
function resizeCanvas() {
  if (!outputCanvas || !outputCanvas.parentElement) return;
  const rect = outputCanvas.parentElement.getBoundingClientRect();
  if (outputCanvas.width !== Math.floor(rect.width) || outputCanvas.height !== Math.floor(rect.height)) {
    outputCanvas.width = Math.floor(rect.width);
    outputCanvas.height = Math.floor(rect.height);
  }

  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}

async function loadMediaPipeModel(modelName = "lite") {
  try {
    const validModel = ["lite", "full", "heavy"].includes(modelName) ? modelName : "lite";
    await poseService.initialize({
      modelPath: `/pose_landmarker_${validModel}.task`
    });
  } catch (err) {
    console.error(`Erro ao carregar MediaPipe Pose (${modelName}):`, err);
    if (gameStatusText) gameStatusText.textContent = `Erro ao carregar modelo ${modelName}.`;
  }
}

async function checkCameraAvailability() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");

    if (cameraSelect) {
      cameraSelect.innerHTML = "";
      if (videoDevices.length === 0) {
        cameraSelect.innerHTML = `<option value="">Nenhuma webcam detectada</option>`;
      } else {
        videoDevices.forEach((device, idx) => {
          const opt = document.createElement("option");
          opt.value = device.deviceId;
          opt.textContent = device.label || `Câmera ${idx + 1}`;
          cameraSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.warn("Erro ao enumerar câmeras:", err);
  }
}

async function changeSourceMode(mode) {
  currentSourceMode = mode;
  stopDetection();
  stopMediaStream();

  if (mode === "webcam") {
    await poseService.setRunningMode("VIDEO");
    await startWebcam();
  } else if (mode === "video") {
    await poseService.setRunningMode("VIDEO");
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
    if (overlayText) overlayText.textContent = "Carregue um arquivo de vídeo no botão abaixo.";
  } else if (mode === "image") {
    await poseService.setRunningMode("IMAGE");
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
    if (overlayText) overlayText.textContent = "Carregue uma imagem estática para testar.";
  }
}

async function startWebcam() {
  try {
    stopMediaStream();
    const deviceId = cameraSelect ? cameraSelect.value : undefined;
    const preferredConstraints = buildCameraConstraints(deviceId);

    try {
      activeStream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (preferredErr) {
      console.warn("Câmera selecionada falhou, tentando fallback para a câmera padrão do navegador...", preferredErr);
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: "user"
        }
      });
    }

    webcamVideo.srcObject = activeStream;
    await webcamVideo.play();

    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "none";
    startDetectionLoop();
  } catch (err) {
    console.error("Erro ao acessar a webcam:", err);
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
    if (overlayText) overlayText.textContent = "Não foi possível abrir a webcam. Selecione um arquivo de vídeo ou permita acesso à câmera.";
  }
}

function stopMediaStream() {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  if (webcamVideo) {
    webcamVideo.pause();
    webcamVideo.srcObject = null;
  }
}

function handleVideoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  stopDetection();
  stopMediaStream();

  const url = URL.createObjectURL(file);
  webcamVideo.src = url;
  webcamVideo.loop = true;
  webcamVideo.play().then(() => {
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "none";
    startDetectionLoop();
  });
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  stopDetection();
  stopMediaStream();

  const url = URL.createObjectURL(file);
  staticImage.src = url;
  staticImage.onload = () => {
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "none";
    processStaticImage();
  };
}

function togglePlayPause() {
  if (isRunning) {
    stopDetection();
  } else {
    if (currentSourceMode === "webcam") {
      startWebcam();
    } else if (webcamVideo.src || webcamVideo.srcObject) {
      webcamVideo.play();
      startDetectionLoop();
    }
  }
}

function startDetectionLoop() {
  if (isRunning) return;
  isRunning = true;
  if (btnTogglePlay) {
    btnTogglePlay.querySelector(".btn-label").textContent = "Pausar Detecção";
  }
  renderFrame();
}

function stopDetection() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (btnTogglePlay) {
    btnTogglePlay.querySelector(".btn-label").textContent = "Iniciar Detecção";
  }
}

/**
 * Loop Principal Otimizado para 60 FPS
 */
function renderFrame(timestamp = performance.now()) {
  if (!isRunning) return;

  frameCounter++;

  if (webcamVideo && webcamVideo.readyState >= 2) {
    const vw = webcamVideo.videoWidth || 1280;
    const vh = webcamVideo.videoHeight || 720;
    const cw = outputCanvas.width;
    const ch = outputCanvas.height;

    const scale = Math.min(cw / vw, ch / vh);
    const drawWidth = vw * scale;
    const drawHeight = vh * scale;
    const offsetX = (cw - drawWidth) / 2;
    const offsetY = (ch - drawHeight) / 2;

    // 1. Renderiza o feed de vídeo
    canvasCtx.drawImage(webcamVideo, offsetX, offsetY, drawWidth, drawHeight);

    // 2. Rastreamento dos marcadores de cor da barra (Verde e Vermelho)
    let barState = null;
    const isBarTrackingEnabled = !chkBarTracker || chkBarTracker.checked;
    if (isBarTrackingEnabled) {
      barState = colorTracker.track(webcamVideo);
    }

    // 3. Inferência do MediaPipe Pose
    const results = poseService.detectForVideo(webcamVideo, timestamp);

    if (results && results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      // 4. Cálculos biomecânicos da Flexão de Cotovelo
      const jointAngles = calculateKeyJointAngles(landmarks, chk3D ? chk3D.checked : false, barState);

      const engineState = gameEngine.processElbowFlexion(jointAngles, barState);
      gameEngine.updateFloatingMessages();

      if (gameEngine.isDebugMode) {
        if (debugAngleVal) debugAngleVal.textContent = `${gameEngine.lastAngle}°`;
        if (debugPhaseVal) debugPhaseVal.textContent = gameEngine.repState;
        if (debugBarVal && barState) {
          debugBarVal.textContent = barState.detected ? (barState.isLevel ? 'Nivelada ✓' : `${barState.tiltAngle}° ⚠️`) : 'Não detectada';
        }
      }

      // 5. Renderização Neon dos Resultados
      drawPoseResults(canvasCtx, landmarks, {
        showConnectors: chkConnectors ? chkConnectors.checked : true,
        showAngles: chkAngles ? chkAngles.checked : true,
        showLandmarkIds: chkIds ? chkIds.checked : false,
        use3D: chk3D ? chk3D.checked : false,
        barState: barState,
        repProgress: engineState ? engineState.repProgress : 0,
        floatingMessages: gameEngine.floatingMessages,
        bounds: { offsetX, offsetY, drawWidth, drawHeight }
      });

      // 6. Atualização de Telemetria da Tabela (apenas quando sidebar aberta a cada 6 frames para economizar CPU)
      if (gameSidebar && gameSidebar.classList.contains("open") && frameCounter % 6 === 0) {
        updateLandmarkTable(landmarks);
      }
    } else if (barState && barState.detected) {
      // Se apenas a barra for detectada
      drawPoseResults(canvasCtx, null, {
        barState: barState,
        floatingMessages: gameEngine.floatingMessages,
        bounds: { offsetX, offsetY, drawWidth, drawHeight }
      });
    }
  }

  animationFrameId = requestAnimationFrame(renderFrame);
}

function processStaticImage() {
  resizeCanvas();
  canvasCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

  const vw = staticImage.naturalWidth || staticImage.width || 1280;
  const vh = staticImage.naturalHeight || staticImage.height || 720;
  const cw = outputCanvas.width;
  const ch = outputCanvas.height;

  const scale = Math.min(cw / vw, ch / vh);
  const drawWidth = vw * scale;
  const drawHeight = vh * scale;
  const offsetX = (cw - drawWidth) / 2;
  const offsetY = (ch - drawHeight) / 2;

  canvasCtx.drawImage(staticImage, offsetX, offsetY, drawWidth, drawHeight);

  const results = poseService.detectImage(staticImage);
  if (results && results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    const jointAngles = calculateKeyJointAngles(landmarks, chk3D ? chk3D.checked : false);

    gameEngine.processElbowFlexion(jointAngles);
    drawPoseResults(canvasCtx, landmarks, {
      showConnectors: chkConnectors ? chkConnectors.checked : true,
      showAngles: chkAngles ? chkAngles.checked : true,
      showLandmarkIds: chkIds ? chkIds.checked : false,
      use3D: chk3D ? chk3D.checked : false,
      floatingMessages: gameEngine.floatingMessages,
      bounds: { offsetX, offsetY, drawWidth, drawHeight }
    });
    updateLandmarkTable(landmarks);
  }
}

function initTableRows() {
  if (!landmarksTbody) return;
  landmarksTbody.innerHTML = "";
  for (let i = 0; i < 33; i++) {
    const tr = document.createElement("tr");
    tr.id = `lm-row-${i}`;
    tr.innerHTML = `
      <td><strong>${LANDMARK_NAMES[i]}</strong></td>
      <td id="lm-${i}-x">-</td>
      <td id="lm-${i}-y">-</td>
      <td id="lm-${i}-z">-</td>
    `;
    landmarksTbody.appendChild(tr);
  }
}

function updateLandmarkTable(landmarks) {
  if (!landmarksTbody) return;
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const elX = document.getElementById(`lm-${i}-x`);
    const elY = document.getElementById(`lm-${i}-y`);
    const elZ = document.getElementById(`lm-${i}-z`);

    if (elX) elX.textContent = lm.x.toFixed(3);
    if (elY) elY.textContent = lm.y.toFixed(3);
    if (elZ) elZ.textContent = (lm.z || 0).toFixed(3);
  }
}

/**
 * Confetes Otimizados
 */
function startConfetti() {
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const colors = ["#00f2fe", "#00ff88", "#ff007f", "#ffe600", "#9d00ff"];
  confettiParticles = Array.from({ length: 80 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: Math.random() * 4 + 2,
    speedX: Math.random() * 2 - 1,
    rotation: Math.random() * 360,
    rotSpeed: Math.random() * 6 - 3
  }));

  function animateConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    confettiParticles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;

      if (p.y > confettiCanvas.height) {
        p.y = -10;
        p.x = Math.random() * confettiCanvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    confettiAnimationFrame = requestAnimationFrame(animateConfetti);
  }

  animateConfetti();
}

function stopConfetti() {
  if (confettiAnimationFrame) {
    cancelAnimationFrame(confettiAnimationFrame);
    confettiAnimationFrame = null;
  }
  if (confettiCanvas) {
    const ctx = confettiCanvas.getContext("2d");
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

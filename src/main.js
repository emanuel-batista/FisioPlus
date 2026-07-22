import { PoseLandmarkerService } from "./poseLandmarkerService.js";
import { drawPoseResults } from "./drawingRenderer.js";
import { LANDMARK_NAMES, calculateKeyJointAngles } from "./vectorMath.js";
import { GameEngine } from "./gameEngine.js";

// Instâncias Globais da Aplicação
const poseService = new PoseLandmarkerService();
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
const debugExerciseVal = document.getElementById("debug-exercise-val");
const debugAngleVal = document.getElementById("debug-angle-val");
const debugPhaseVal = document.getElementById("debug-phase-val");

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
const canvasCtx = outputCanvas.getContext("2d");
const canvasOverlayMsg = document.getElementById("canvas-overlay-msg");
const overlayText = document.getElementById("overlay-text");
const btnTogglePlay = document.getElementById("btn-toggle-play");
const videoUploadInput = document.getElementById("video-upload");
const imageUploadInput = document.getElementById("image-upload");

// Seletores de Configurações
const challengeExerciseSelect = document.getElementById("challenge-exercise-select");
const sourceModeSelect = document.getElementById("source-mode-select");
const cameraSelect = document.getElementById("camera-select");

// Checkboxes de Opções de Vetores
const chkConnectors = document.getElementById("chk-connectors");
const chkVectors = document.getElementById("chk-vectors");
const chkAngles = document.getElementById("chk-angles");
const chkIds = document.getElementById("chk-ids");
const chk3D = document.getElementById("chk-3d");

const landmarksTbody = document.getElementById("landmarks-tbody");

// Estado do Player & Loop
let isRunning = false;
let animationFrameId = null;
let currentSourceMode = "webcam";
let activeStream = null;

// Confetes Engine
let confettiParticles = [];
let confettiAnimationFrame = null;

/**
 * Utilitários de Leitura e Escrita de Cookies
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

/**
 * Inicialização Principal ao carregar o DOM
 */
document.addEventListener("DOMContentLoaded", async () => {
  initCookieSystem();
  setupEventListeners();
  setupGameEngineCallbacks();
  setupKeySequenceDetector();
  initTableRows();

  // 1. Carregamento dos modelos
  updateLoadingProgress(30, "Mapeando dispositivos de vídeo...");
  await checkCameraAvailability();

  updateLoadingProgress(65, "Inicializando motor de visão computacional MediaPipe...");
  await loadMediaPipeModel();

  updateLoadingProgress(100, "Pronto para o evento!");
  
  // Transição para a Tela Inicial (Start Screen)
  setTimeout(() => {
    gameEngine.setScreen('start');
  }, 600);
});

/**
 * Inicializa o aviso de cookies e recupera a preferência salva
 */
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

/**
 * Ativa o Modo Debug (1234) com repetições ilimitadas para testes de iluminação e posicionamento de câmera
 */
function activateDebugMode() {
  gameEngine.setDebugMode(true);
  gameEngine.selectedExercise = challengeExerciseSelect ? challengeExerciseSelect.value : 'elbowFlexion';
  gameEngine.resetGame();
  gameEngine.setScreen('game');

  if (gameSidebar) gameSidebar.classList.add("open");
  if (debugBanner) debugBanner.style.display = "block";
  if (debugSidebarCard) debugSidebarCard.style.display = "block";
  if (hudRepsTotal) hudRepsTotal.textContent = "/ ∞";

  if (chkDisableAutocam && chkDisableAutocam.checked) {
    if (gameStatusText) gameStatusText.textContent = "MODO DEBUG ATIVO (1234): Câmera automática pausada por preferência de cookie.";
  } else {
    if (gameStatusText) gameStatusText.textContent = "MODO DEBUG ATIVO (1234): Repetições Ilimitadas (∞) ativadas para ajuste de iluminação e câmera.";
  }
}

/**
 * Desativa o Modo Debug
 */
function deactivateDebugMode() {
  gameEngine.setDebugMode(false);
  if (debugBanner) debugBanner.style.display = "none";
  if (debugSidebarCard) debugSidebarCard.style.display = "none";
  if (hudRepsTotal) hudRepsTotal.textContent = "/ 10";
}

/**
 * Configura os callbacks da Engine do Jogo
 */
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

      // Verifica preferência de não abrir câmera automaticamente (salva via cookie)
      const disableAutocam = chkDisableAutocam && chkDisableAutocam.checked;

      if (!isRunning && currentSourceMode === 'webcam') {
        if (disableAutocam) {
          if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
          if (overlayText) overlayText.textContent = "Câmera automática desativada (Modo Debug). Clique em 'Iniciar Câmera' para testar.";
        } else {
          startWebcam();
        }
      }
    }
  };

  gameEngine.onRepCount = (data) => {
    if (hudRepsCount) hudRepsCount.textContent = data.reps;
    if (hudRepsTotal) hudRepsTotal.textContent = `/ ${data.target}`;
    if (hudAccuracyPercent) hudAccuracyPercent.textContent = `${data.accuracy}%`;
    if (gameStatusText && data.stateText) gameStatusText.textContent = data.stateText;
  };

  gameEngine.onVictory = (data) => {
    if (modalVictory) {
      document.getElementById("victory-accuracy-val").textContent = `${data.accuracy}%`;
      modalVictory.classList.add("active");
      startConfetti();
    }
  };

  gameEngine.onDebugChange = (isDebug) => {
    if (debugBanner) debugBanner.style.display = isDebug ? "block" : "none";
    if (debugSidebarCard) debugSidebarCard.style.display = isDebug ? "block" : "none";
    if (hudRepsTotal) hudRepsTotal.textContent = isDebug ? "/ ∞" : "/ 10";
  };
}

/**
 * Registra os Listeners de Eventos de Botões e UI
 */
function setupEventListeners() {
  // Banner de Cookies
  if (btnAcceptCookies) {
    btnAcceptCookies.addEventListener("click", () => {
      setCookie("fisioplus_cookie_consent", "true", 365);
      if (cookieBanner) cookieBanner.style.display = "none";
    });
  }

  // Checkbox de Não Abrir Câmera Automática (Salvo em Cookie)
  if (chkDisableAutocam) {
    chkDisableAutocam.addEventListener("change", (e) => {
      setCookie("fisioplus_disable_autocam", e.target.checked ? "true" : "false", 365);
    });
  }

  // Navegação da SPA
  if (btnGotoChallenge) {
    btnGotoChallenge.addEventListener("click", () => {
      gameEngine.initAudio();
      gameEngine.setScreen('challenge');
    });
  }

  if (btnStartGame) {
    btnStartGame.addEventListener("click", () => {
      gameEngine.selectedExercise = challengeExerciseSelect ? challengeExerciseSelect.value : 'elbowFlexion';
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

  // Ações do Banner Debug (1234)
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
      if (gameSidebar) gameSidebar.classList.toggle("open");
    });
  }

  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener("click", () => {
      if (gameSidebar) gameSidebar.classList.remove("open");
    });
  }

  if (btnTogglePlay) {
    btnTogglePlay.addEventListener("click", togglePlayPause);
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
 * Ajusta o tamanho do Canvas para preencher o container com proporção correta
 */
function resizeCanvas() {
  if (!outputCanvas || !outputCanvas.parentElement) return;
  const rect = outputCanvas.parentElement.getBoundingClientRect();
  outputCanvas.width = rect.width;
  outputCanvas.height = rect.height;

  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}

/**
 * Carrega o modelo MediaPipe Pose
 */
async function loadMediaPipeModel() {
  try {
    await poseService.initialize();
  } catch (err) {
    console.error("Erro ao carregar MediaPipe Pose:", err);
    if (gameStatusText) gameStatusText.textContent = "Erro ao carregar modelo MediaPipe.";
  }
}

/**
 * Verifica webcams físicas disponíveis no navegador
 */
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

/**
 * Alterna modo de entrada entre Webcam, Vídeo e Imagem
 */
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

/**
 * Inicia o streaming da Webcam
 */
async function startWebcam() {
  try {
    stopMediaStream();
    const deviceId = cameraSelect ? cameraSelect.value : undefined;
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { width: 1280, height: 720 }
    };

    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    webcamVideo.srcObject = activeStream;
    await webcamVideo.play();

    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "none";
    startDetectionLoop();
  } catch (err) {
    console.error("Erro ao acessar a webcam:", err);
    if (canvasOverlayMsg) canvasOverlayMsg.style.display = "flex";
    if (overlayText) overlayText.textContent = "Não foi possível abrir a webcam. Escolha um arquivo de vídeo.";
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

/**
 * Upload de Vídeo Local
 */
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

/**
 * Upload de Imagem Estática
 */
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

/**
 * Iniciar / Pausar Detecção
 */
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
 * Loop de Renderização a cada Frame mantendo Proporção de Aspecto sem Esticar
 */
function renderFrame(timestamp = performance.now()) {
  if (!isRunning) return;

  resizeCanvas();
  canvasCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

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

    canvasCtx.drawImage(webcamVideo, offsetX, offsetY, drawWidth, drawHeight);

    const results = poseService.detectForVideo(webcamVideo, timestamp);

    if (results && results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      const jointAngles = calculateKeyJointAngles(landmarks, chk3D ? chk3D.checked : false);

      gameEngine.processJointAngles(jointAngles);
      gameEngine.updateFloatingMessages();

      if (gameEngine.isDebugMode) {
        if (debugExerciseVal) debugExerciseVal.textContent = gameEngine.selectedExercise;
        if (debugAngleVal) debugAngleVal.textContent = `${gameEngine.lastAngle}°`;
        if (debugPhaseVal) debugPhaseVal.textContent = gameEngine.repState;
      }

      drawPoseResults(canvasCtx, landmarks, {
        showConnectors: chkConnectors ? chkConnectors.checked : true,
        showVectors: chkVectors ? chkVectors.checked : true,
        showAngles: chkAngles ? chkAngles.checked : true,
        showLandmarkIds: chkIds ? chkIds.checked : false,
        use3D: chk3D ? chk3D.checked : false,
        floatingMessages: gameEngine.floatingMessages,
        bounds: { offsetX, offsetY, drawWidth, drawHeight }
      });

      updateLandmarkTable(landmarks);
    }
  }

  animationFrameId = requestAnimationFrame(renderFrame);
}

/**
 * Processa uma Imagem Estática única mantendo Proporção
 */
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

    gameEngine.processJointAngles(jointAngles);
    drawPoseResults(canvasCtx, landmarks, {
      showConnectors: chkConnectors ? chkConnectors.checked : true,
      showVectors: chkVectors ? chkVectors.checked : true,
      showAngles: chkAngles ? chkAngles.checked : true,
      showLandmarkIds: chkIds ? chkIds.checked : false,
      use3D: chk3D ? chk3D.checked : false,
      floatingMessages: gameEngine.floatingMessages,
      bounds: { offsetX, offsetY, drawWidth, drawHeight }
    });
    updateLandmarkTable(landmarks);
  }
}

/**
 * Tabela com os 33 Landmarks
 */
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
 * Sistema de Confetes Digitais & Chroma Keying de Green Screen em Canvas
 */
function startConfetti() {
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const colors = ["#00f2fe", "#00ff88", "#ff007f", "#ffe600", "#9d00ff"];
  confettiParticles = Array.from({ length: 120 }, () => ({
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

    if (victoryConfettiImg && victoryConfettiImg.complete && victoryConfettiImg.naturalWidth > 0) {
      try {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(victoryConfettiImg, 0, 0, confettiCanvas.width, confettiCanvas.height);
        
        const imageData = ctx.getImageData(0, 0, confettiCanvas.width, confettiCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (g > 100 && g > r * 1.2 && g > b * 1.2) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.restore();
      } catch (e) {
        // Fallback
      }
    }

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

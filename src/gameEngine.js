/**
 * Game Engine para FisioPlus - SPA Gamificada de Estande
 * Gerencia os estados do jogo, contagem de repetições biomecânicas, precisão %,
 * mensagens flutuantes, modo debug ilimitado (código 1234) e gatilho de vitória.
 */

export class GameEngine {
  constructor() {
    this.currentScreen = 'loading'; // 'loading' | 'start' | 'challenge' | 'game' | 'victory'
    
    // Modo Debug Ativo (Gatilho via sequência 1234)
    this.isDebugMode = false;

    // Configurações e Meta do Desafio
    this.targetReps = 10;
    this.minAccuracyToWin = 90; // 90%
    this.selectedExercise = 'elbowFlexion'; // 'elbowFlexion' | 'squat' | 'shoulderAbduction'
    
    // Estado Atual da Sessão de Jogo
    this.repsCount = 0;
    this.currentAccuracy = 100;
    this.accuracyHistory = [];
    this.repState = 'extended'; // 'extended' | 'flexed'
    this.lastAngle = 180;
    
    // Popups flutuantes no canvas (ex: "+1 REP!", "EXCELENTE!", "95% PRECISÃO")
    this.floatingMessages = [];
    
    // Efeitos sonoros acionados via Web Audio API
    this.audioCtx = null;
    
    // Callbacks de UI
    this.onStateChange = null;
    this.onRepCount = null;
    this.onVictory = null;
    this.onDebugChange = null;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playBeep(freq = 440, duration = 0.15, type = 'sine') {
    try {
      if (!this.audioCtx) this.initAudio();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Áudio ignorado caso haja restrição do navegador
    }
  }

  playVictorySound() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBeep(freq, 0.25, 'triangle');
      }, idx * 120);
    });
  }

  /**
   * Ativa ou desativa o Modo Debug (Código Secret 1234)
   * No modo Debug, a contagem de repetições é ilimitada para teste contínuo de iluminação/câmera.
   */
  setDebugMode(enabled) {
    this.isDebugMode = enabled;
    if (enabled) {
      this.targetReps = Infinity;
    } else {
      this.targetReps = 10;
    }

    if (this.onDebugChange) {
      this.onDebugChange(enabled);
    }

    if (this.onRepCount) {
      this.onRepCount({
        reps: this.repsCount,
        target: this.isDebugMode ? '∞' : this.targetReps,
        accuracy: this.currentAccuracy,
        stateText: this.isDebugMode ? 'Modo Debug: Repetições Ilimitadas para ajuste de iluminação' : 'Aguardando movimento...'
      });
    }
  }

  /**
   * Altera a tela visível da SPA
   */
  setScreen(screenName) {
    this.currentScreen = screenName;
    if (this.onStateChange) {
      this.onStateChange(screenName);
    }
  }

  /**
   * Reseta a sessão de jogo para um novo participante no estande
   */
  resetGame() {
    this.repsCount = 0;
    this.currentAccuracy = 100;
    this.accuracyHistory = [];
    this.repState = 'extended';
    this.floatingMessages = [];
    
    if (this.onRepCount) {
      this.onRepCount({
        reps: this.repsCount,
        target: this.isDebugMode ? '∞' : this.targetReps,
        accuracy: this.currentAccuracy,
        stateText: 'Aguardando movimento...'
      });
    }
  }

  /**
   * Simula manualmente 1 repetição (Modo Debug)
   */
  simulateRepetition() {
    this.repsCount++;
    this.currentAccuracy = 95;
    this.playBeep(880, 0.15, 'triangle');
    const targetText = this.isDebugMode ? '∞' : this.targetReps;
    this.addFloatingMessage(`+1 REP DEBUG! (${this.repsCount}/${targetText})`, '#ff0055', 1.4);

    if (this.onRepCount) {
      this.onRepCount({
        reps: this.repsCount,
        target: targetText,
        accuracy: this.currentAccuracy,
        stateText: `Repetição ${this.repsCount} simulada no modo Debug`
      });
    }

    if (!this.isDebugMode && this.repsCount >= this.targetReps) {
      this.triggerVictory();
    }
  }

  /**
   * Adiciona mensagem flutuante para ser renderizada sobre o vídeo/canvas
   */
  addFloatingMessage(text, color = '#00f2fe', scale = 1.0) {
    this.floatingMessages.push({
      text,
      color,
      scale,
      opacity: 1.0,
      yOffset: 0,
      createdAt: Date.now()
    });
  }

  /**
   * Atualiza a física e opacidade das mensagens flutuantes a cada frame
   */
  updateFloatingMessages() {
    const now = Date.now();
    this.floatingMessages = this.floatingMessages.filter(msg => {
      const elapsed = (now - msg.createdAt) / 1000;
      msg.yOffset = elapsed * 40;
      msg.opacity = Math.max(0, 1 - elapsed / 1.5);
      return msg.opacity > 0;
    });
  }

  /**
   * Processa ângulos articulada calculados pelo vectorMath
   */
  processJointAngles(jointAngles) {
    if (this.currentScreen !== 'game' || !jointAngles) return null;

    let targetAngle = 0;
    let flexThreshold = 80;   // Ângulo para flexão máxima
    let extendThreshold = 150;// Ângulo para extensão máxima

    if (this.selectedExercise === 'elbowFlexion') {
      targetAngle = Math.max(jointAngles.leftElbow || 0, jointAngles.rightElbow || 0);
      flexThreshold = 80;
      extendThreshold = 150;
    } else if (this.selectedExercise === 'squat') {
      targetAngle = Math.min(jointAngles.leftKnee || 180, jointAngles.rightKnee || 180);
      flexThreshold = 95;
      extendThreshold = 160;
    } else {
      targetAngle = Math.max(jointAngles.leftShoulder || 0, jointAngles.rightShoulder || 0);
      flexThreshold = 110;
      extendThreshold = 40;
    }

    if (targetAngle === 0) return null;

    // Cálculo da Qualidade da Forma (Precisão Postural)
    let frameAccuracy = 100;
    if (targetAngle < 30 || targetAngle > 175) {
      frameAccuracy = 95;
    }
    this.accuracyHistory.push(frameAccuracy);
    if (this.accuracyHistory.length > 60) this.accuracyHistory.shift();

    const sumAcc = this.accuracyHistory.reduce((a, b) => a + b, 0);
    this.currentAccuracy = Math.round(sumAcc / this.accuracyHistory.length);

    // Lógica do Contador de Repetições
    let stateText = 'Mantenha o movimento constante';
    const targetText = this.isDebugMode ? '∞' : this.targetReps;

    if (this.repState === 'extended') {
      if (targetAngle <= flexThreshold) {
        this.repState = 'flexed';
        stateText = 'Flexão máxima! Agora retorne...';
        this.playBeep(587.33, 0.1, 'sine');
        this.addFloatingMessage('EXCELENTE FLEXÃO!', '#00ff88', 1.1);
      } else {
        stateText = 'Flexione para realizar a repetição';
      }
    } else if (this.repState === 'flexed') {
      if (targetAngle >= extendThreshold) {
        this.repState = 'extended';
        this.repsCount++;
        stateText = `Repetição ${this.repsCount} concluída!`;
        
        this.playBeep(880, 0.15, 'triangle');
        this.addFloatingMessage(`+1 REP! (${this.repsCount}/${targetText})`, '#00f2fe', 1.4);

        if (this.onRepCount) {
          this.onRepCount({
            reps: this.repsCount,
            target: targetText,
            accuracy: this.currentAccuracy,
            stateText: stateText
          });
        }

        // Verifica Condição de Vitória (Somente fora do modo Debug)
        if (!this.isDebugMode && this.repsCount >= this.targetReps) {
          if (this.currentAccuracy >= this.minAccuracyToWin) {
            this.triggerVictory();
          } else {
            this.addFloatingMessage('Tente novamente com mais de 90% de precisão!', '#ff0055', 1.2);
          }
        }
      } else {
        stateText = 'Estenda o membro completamente';
      }
    }

    this.lastAngle = targetAngle;

    return {
      reps: this.repsCount,
      target: targetText,
      accuracy: this.currentAccuracy,
      targetAngle: targetAngle,
      repState: this.repState,
      stateText: stateText
    };
  }

  /**
   * Gatilho de Vitória com Confete e Telas do Estande
   */
  triggerVictory() {
    this.playVictorySound();
    this.setScreen('victory');
    if (this.onVictory) {
      this.onVictory({
        reps: this.repsCount,
        accuracy: this.currentAccuracy
      });
    }
  }
}

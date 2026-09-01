/**
 * Game Engine para FisioPlus - Desafio de Flexão de Cotovelo com Barra no Estande
 * Gerencia repetições, precisão postural em tempo real, simetria da barra e condições de vitória.
 */

export class GameEngine {
  constructor() {
    this.currentScreen = 'loading'; // 'loading' | 'start' | 'challenge' | 'game' | 'victory'
    
    // Modo Debug Ativo (Gatilho via sequência 1234)
    this.isDebugMode = false;

    // Configurações do Desafio de Estande
    this.targetReps = 10;
    this.minAccuracyToWin = 90; // 90%
    this.selectedExercise = 'elbowFlexion'; // Foco exclusivo na Flexão de Cotovelo
    
    // Estado Atual da Sessão
    this.repsCount = 0;
    this.currentAccuracy = 100;
    this.accuracyHistory = [];
    this.repState = 'extended'; // 'extended' | 'flexing' | 'flexed' | 'extending'
    this.lastAngle = 160;
    this.repProgress = 0; // 0% a 100% da repetição atual
    this.isBarLevel = true;
    
    // Mensagens flutuantes no canvas
    this.floatingMessages = [];
    
    // Efeitos sonoros via Web Audio API
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
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Ignora erro de áudio
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
   */
  setDebugMode(enabled) {
    this.isDebugMode = enabled;
    this.targetReps = enabled ? Infinity : 10;

    if (this.onDebugChange) {
      this.onDebugChange(enabled);
    }

    if (this.onRepCount) {
      this.onRepCount({
        reps: this.repsCount,
        target: this.isDebugMode ? '∞' : this.targetReps,
        accuracy: this.currentAccuracy,
        stateText: this.isDebugMode ? 'Modo Debug: Repetições Ilimitadas' : 'Posicione-se com a barra e inicie a flexão...'
      });
    }
  }

  setScreen(screenName) {
    this.currentScreen = screenName;
    if (this.onStateChange) {
      this.onStateChange(screenName);
    }
  }

  /**
   * Reseta a sessão de jogo para um novo participante
   */
  resetGame() {
    this.repsCount = 0;
    this.currentAccuracy = 100;
    this.accuracyHistory = [];
    this.repState = 'extended';
    this.repProgress = 0;
    this.floatingMessages = [];
    
    if (this.onRepCount) {
      this.onRepCount({
        reps: this.repsCount,
        target: this.isDebugMode ? '∞' : this.targetReps,
        accuracy: this.currentAccuracy,
        stateText: 'Segure a barra e inicie o movimento de flexão!'
      });
    }
  }

  /**
   * Simula manualmente 1 repetição (Modo Debug)
   */
  simulateRepetition() {
    this.repsCount++;
    this.currentAccuracy = 96;
    this.playBeep(880, 0.15, 'triangle');
    const targetText = this.isDebugMode ? '∞' : this.targetReps;
    this.addFloatingMessage(`+1 REP DEBUG! (${this.repsCount}/${targetText})`, '#00f2fe', 1.4);

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

  updateFloatingMessages() {
    const now = Date.now();
    this.floatingMessages = this.floatingMessages.filter(msg => {
      const elapsed = (now - msg.createdAt) / 1000;
      msg.yOffset = elapsed * 45;
      msg.opacity = Math.max(0, 1 - elapsed / 1.4);
      return msg.opacity > 0;
    });
  }

  /**
   * Processa os ângulos articulares e dados da barra
   */
  processElbowFlexion(jointAngles, barState = null) {
    if (this.currentScreen !== 'game' || !jointAngles) return null;

    // Ângulo alvo de flexão de cotovelo
    const targetAngle = jointAngles.avgElbow || Math.max(jointAngles.leftElbow || 0, jointAngles.rightElbow || 0);
    if (targetAngle <= 0) return null;

    const flexThreshold = 75;    // Ângulo mínimo para flexão completa
    const extendThreshold = 145; // Ângulo para extensão completa

    // Cálculo do progresso da repetição (0% a 100%)
    const clampedAngle = Math.max(flexThreshold, Math.min(extendThreshold, targetAngle));
    this.repProgress = Math.round(((extendThreshold - clampedAngle) / (extendThreshold - flexThreshold)) * 100);

    // Avaliação de Precisão Postural (Biomecânica e Simetria da Barra)
    let frameAccuracy = 100;

    // Penalidade se a barra estiver muito inclinada
    if (barState && barState.detected && !barState.isLevel) {
      frameAccuracy -= 15;
      this.isBarLevel = false;
    } else {
      this.isBarLevel = true;
    }

    // Penalidade se houver assimetria exagerada entre os braços
    if (jointAngles.elbowDiff > 25) {
      frameAccuracy -= 10;
    }

    this.accuracyHistory.push(frameAccuracy);
    if (this.accuracyHistory.length > 50) this.accuracyHistory.shift();

    const sumAcc = this.accuracyHistory.reduce((a, b) => a + b, 0);
    this.currentAccuracy = Math.round(sumAcc / this.accuracyHistory.length);

    // Lógica do Ciclo de Repetições
    let stateText = 'Mantenha a barra alinhada e flexione os braços';
    const targetText = this.isDebugMode ? '∞' : this.targetReps;

    if (this.repState === 'extended') {
      if (targetAngle <= flexThreshold) {
        this.repState = 'flexed';
        stateText = 'Excelente flexão! Agora desça com controle...';
        this.playBeep(659.25, 0.1, 'sine');
        this.addFloatingMessage('TOPO ALCANÇADO!', '#00ff88', 1.2);
      } else {
        stateText = this.isBarLevel ? 'Suba a barra até o peito' : '⚠️ Alinhe a barra horizontalmente!';
      }
    } else if (this.repState === 'flexed') {
      if (targetAngle >= extendThreshold) {
        this.repState = 'extended';
        this.repsCount++;
        stateText = `Repetição ${this.repsCount} concluída com sucesso!`;
        
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

        // Verifica vitória
        if (!this.isDebugMode && this.repsCount >= this.targetReps) {
          if (this.currentAccuracy >= this.minAccuracyToWin) {
            this.triggerVictory();
          } else {
            this.addFloatingMessage('Mantenha precisão acima de 90% para ganhar!', '#ff0055', 1.2);
          }
        }
      } else {
        stateText = 'Estenda os braços até a posição inicial';
      }
    }

    this.lastAngle = targetAngle;

    return {
      reps: this.repsCount,
      target: targetText,
      accuracy: this.currentAccuracy,
      targetAngle: targetAngle,
      repState: this.repState,
      repProgress: this.repProgress,
      isBarLevel: this.isBarLevel,
      stateText: stateText
    };
  }

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

# FisioPlus - Desafio Biomecânico Gamificado com IA

<div align="center">

<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/javascript.png" width="40" height="40" alt="JavaScript" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/html.png" width="40" height="40" alt="HTML5" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/css.png" width="40" height="40" alt="CSS3" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/vite.png" width="40" height="40" alt="Vite" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/node_js.png" width="40" height="40" alt="Node.js" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/git.png" width="40" height="40" alt="Git" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/github.png" width="40" height="40" alt="GitHub" />

### 🏆 Projeto Acadêmico — Feira de Cursos (FEC) da Universidade de Araraquara (UNIARA)
**Status do Projeto: ✅ 100% PRONTO E OTIMIZADO PARA A FEIRA**

</div>

---

## 📋 Sumário

- [Apresentação do Projeto](#apresentação-do-projeto)
- [O Desafio de Estande (FEC - UNIARA)](#o-desafio-de-estande-fec---uniara)
- [Sistema de Rastreamento Óptico da Barra](#sistema-de-rastreamento-óptico-da-barra)
- [Arquitetura de Módulos](#arquitetura-de-módulos)
- [Como Executar e Escolher os Modelos de IA](#como-executar-e-escolher-os-modelos-de-ia)
- [📱 Painel Mobile de Controle & Túnel ADM](#-painel-mobile-de-controle--túnel-adm)
- [Modo Debug do Estande (Código 1234)](#modo-debug-do-estande-código-1234)
- [Guia do Operador para o Dia do Evento](#guia-do-operador-para-o-dia-do-evento)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Licença](#licença)

---

## 🎯 Apresentação do Projeto

O **FisioPlus** é uma aplicação web gamificada e de alto impacto visual desenvolvida para demonstrar a união prática entre **Engenharia de Software, Inteligência Artificial, Fisioterapia e Educação Física**.

Utilizando **Google MediaPipe Pose Landmarker** em conjunto com um **Rastreador Óptico por Cores em HSV**, o sistema avalia a execução biomecânica dos participantes em tempo real, calculando amplitudes articulares, contagem automática de repetições, velocidade, simetria postural e acurácia do movimento.

---

## 🎪 O Desafio de Estande (FEC - UNIARA)

O evento conta com o **Desafio da Flexão de Cotovelo / Rosca Direta com Barra**:

1. **Objetivo do Participante**: Realizar **10 repetições completas** com pelo menos **90% de precisão biomecânica**.
2. **Ciclo de Movimento**:
   - **Extensão Inicial / Excêntrica**: Braços estendidos ($\ge 145^\circ$).
   - **Flexão de Pico / Concêntrica**: Barra elevada até a altura do peito ($\le 75^\circ$).
3. **Avaliação em Tempo Real**:
   - **Barra de Progresso Dinâmica**: Indicador visual lateral no canvas acompanhando cada repetição de 0% a 100%.
   - **Detector de Simetria e Nível**: Penaliza a precisão caso o participante incline a barra (diferença $> 12^\circ$) ou puxe mais com um braço do que com o outro.
4. **Celebração e Vitória**:
   - Ao atingir as 10 repetições com $\ge 90\%$, o sistema dispara efeitos sonoros de vitória via Web Audio API e celebração com confetes neon na tela.

---

## 🔬 Sistema de Rastreamento Óptico da Barra

Para garantir precisão milimétrica mesmo em **webcams de baixo custo** e sob **iluminação desafiadora de feiras**, o projeto conta com uma barra física com duas bolas de isopor coloridas nas extremidades:

- 🟢 **Ponta 1 (Verde)**: Rastreamento em faixa HSV ($70^\circ - 170^\circ$).
- 🔴 **Ponta 2 (Vermelha)**: Rastreamento em faixa HSV ($335^\circ - 360^\circ$ e $0^\circ - 25^\circ$).
- ⚡ **Fusão Sensorial & Filtro EMA**: Os centróides das cores refinam a posição dos punhos e antebraços, eliminando tremores (*jitter*) e calculando a linha laser da barra na tela.

---

## 🏗️ Arquitetura de Módulos

O código-fonte está estruturado de forma modular e otimizada dentro de `src/` e `server/`:

```
FisioPlus/
├── src/
│   ├── main.js                   # Ponto de entrada, ciclo de vida da SPA e coordenação
│   ├── colorTracker.js           # Detector de cores HSV ultra-leve para a barra física
│   ├── poseLandmarkerService.js  # Abstração do MediaPipe PoseLandmarker (Lite, Full, Heavy)
│   ├── gameEngine.js             # Motor de regras, contagem de repetições, precisão e sons
│   ├── vectorMath.js             # Kernel matemático vetorial e ângulos 2D/3D
│   ├── drawingRenderer.js        # Engine gráfica Cyberpunk Neon a 60 FPS
│   ├── tunnelClient.js           # Cliente WebSocket bidirecional para controle remoto
│   └── style.css                 # Interface futurista neon de alto contraste
├── server/
│   ├── control-server.js         # Servidor WebSocket & HTTP com suporte a rede local e 4G
│   └── control-panel.html        # Interface Mobile-First com telemetria e botões de ADM
└── test/                         # Suíte de testes unitários automatizados
```

---

## 🚀 Como Executar e Escolher os Modelos de IA

O projeto está otimizado para rodar com **60 FPS fluidos em máquinas com apenas 8GB de RAM**. Você pode escolher entre 3 modelos de IA:

### 1. Modelos Disponíveis

| Modelo | Arquivo | Tamanho | Recomendação |
| :--- | :--- | :--- | :--- |
| **`lite`** | `pose_landmarker_lite.task` | **5.7 MB** | **Padrão para a Feira (8GB RAM / Webcam de entrada / 60 FPS)** |
| **`full`** | `pose_landmarker_full.task` | **9.3 MB** | Notebooks intermediários |
| **`heavy`** | `pose_landmarker_heavy.task` | **30.6 MB** | Desktops de alta performance com GPU dedicada |

### 2. Comandos de Inicialização do Jogo (Terminal)

```bash
# Instalar dependências (apenas na primeira vez)
npm install

# 🟢 Iniciar em Modo LITE (Recomendado para a Feira)
npm run dev
# ou
npm run dev:lite

# 🟡 Iniciar em Modo FULL
npm run dev:full

# 🔴 Iniciar em Modo HEAVY
npm run dev:heavy
```

---

## 📱 Painel Mobile de Controle & Túnel ADM

Para permitir que a equipe do estande controle o jogo e as funções de administrador **direto pelo celular** sem precisar passar na frente da câmera:

<div align="center">
  <p><strong>Senha de Acesso do Administrador:</strong> <code>FisioPlus123%</code></p>
</div>

### 1. Como Iniciar o Servidor de Controle

Abra um segundo terminal e escolha a forma de conexão:

#### Opção A: Na Mesma Rede Wi-Fi (Mais Rápido e Local)
```bash
npm run tunnel
```
> O terminal exibirá o endereço IP local (ex: `http://192.168.1.73:4010/`). Abra no celular conectado no mesmo Wi-Fi.

#### Opção B: Em Qualquer Rede / 4G / 5G (Acesso Global na Internet)
```bash
npm run tunnel:public
```
> O terminal gerará uma **URL Pública HTTPS segura** com o ngrok (ex: `https://fisioplus-xxxx.ngrok-free.app/`). Esse caminho evita o bloqueio do `localtunnel` em firewalls universitários e continua funcionando em redes externas ou 4G/5G.

Se preferir iniciar o túnel pelo próprio servidor local:
```bash
node server/control-server.js --public
```
> O projeto tenta abrir o túnel automaticamente com o ngrok e mostra a URL pública no console.

### 2. Recursos do Painel no Celular
- 🔒 **Sessão Persistente**: Após digitar a senha `FisioPlus123%`, o celular salva a sessão no aparelho e reconecta automaticamente.
- 👥 **Múltiplos Operadores Simultâneos**: Toda a equipe pode estar conectada ao mesmo tempo.
- ⚡ **Ajuste Rápido de Placar**: Botões gigantes de `+1 REP` e `-1 REP` com vibração tátil no celular.
- 🎮 **Fluxo do Estande**: *Iniciar Partida*, *Próximo Participante* (limpa vitória e reseta), *Tela de Regras* e *Resetar*.
- 🐞 **ADM & Modo Debug (1234)**: *Simular 1 Repetição*, *Disparar Tela de Vitória com Confetes*, *Ligar/Pausar Câmera* e *Pausar Auto-Câmera*.
- 📊 **Telemetria ao Vivo**: Placar de repetições, precisão biomecânica, estado da câmera e tela ativa em tempo real.

---

## 🛠️ Modo Debug do Estande (Código 1234)

Para testes antes de abrir para os participantes:
- Digite a sequência **`1234`** no teclado do PC ou toque em **"Alternar Debug"** no celular a qualquer momento.
- **Recursos do Debug**:
  - Repetições Ilimitadas ($\infty$) para ajuste fino de iluminação e posição da câmera.
  - Botão de simular repetição manual (`+1 Rep`).
  - Botão de testar tela de vitória (`Testar Vitória`).
  - Opção de pausar câmera automática salva via cookie.

---

## 💡 Guia do Operador para o Dia do Evento

1. **Posicionamento do Participante**:
   - A pessoa deve ficar **DE FRENTE** para a câmera (não de lado), a uma distância de **1,5 a 2 metros**.
   - Segurar a barra na largura dos ombros com as palmas voltadas para cima (pegada supinada).
2. **Iluminação**:
   - Posicione uma luz frontal suave (ex: ring light ou luminária LED) voltada para o participante e para a barra.
3. **Navegador**:
   - Abra no **Google Chrome** ou **Microsoft Edge** e pressione **`F11`** para tela cheia.
   - Certifique-se de que a *Aceleração por Hardware* está ativa em `chrome://settings/system`.

---

## 🧪 Testes Automatizados

O projeto possui suíte de testes unitários para o motor biomecânico e servidor WebSocket:

```bash
npm test
```

---

## 📦 Tecnologias Utilizadas

- **JavaScript (ES6+ / ESM)**: Código limpo e modular sem frameworks pesados.
- **HTML5 Canvas 2D**: Renderização com shaders neon e baixa sobrecarga de CPU.
- **MediaPipe Tasks Vision (WebAssembly / WebGL)**: IA de rastreamento postural em tempo real.
- **Web Audio API**: Feedback sonoro nativo sintetizado em tempo de execução.
- **WebSocket Server (`ws`)**: Sincronização remota bidirecional em tempo real.
- **Vite**: Bundler ultra rápido com HMR.

---

## 📄 Licença

Este projeto é desenvolvido para fins acadêmicos e educacionais na **UNIARA - Universidade de Araraquara**. Disponibilizado sob a licença MIT.


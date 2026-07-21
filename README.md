# FisioPlus - Analisador por IA de Exercícios Físicos

<div align="center">

<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/javascript.png" width="40" height="40" alt="JavaScript" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/html.png" width="40" height="40" alt="HTML5" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/css.png" width="40" height="40" alt="CSS3" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/vite.png" width="40" height="40" alt="Vite" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/node_js.png" width="40" height="40" alt="Node.js" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/git.png" width="40" height="40" alt="Git" />
<img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/github.png" width="40" height="40" alt="GitHub" />

<p><strong>Projeto Acadêmico - Feira de Cursos (FEC) da Universidade de Araraquara (UNIARA)</strong></p>
<p><em>Status do Projeto: Protótipo em Fase Inicial de Testes e Adaptação</em></p>

</div>

---

## Sumário

- [Apresentação do Projeto](#apresentação-do-projeto)
- [Contexto FEC - UNIARA](#contexto-fec---uniara)
- [Caso de Uso: Análise da Rosca Direta](#caso-de-uso-análise-da-rosca-direta)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitetura de Módulos](#arquitetura-de-módulos)
- [Funcionalidades Técnicas](#funcionalidades-técnicas)
- [Métricas de Completude e Repetição](#métricas-de-completude-e-repetição)
- [Requisitos de Ambiente](#requisitos-de-ambiente)
- [Instalação e Execução](#instalação-e-execução)
- [Configuração do Modelo MediaPipe](#configuração-do-modelo-mediapipe)
- [Licença](#licença)

---

## Apresentação do Projeto

O **FisioPlus** é uma plataforma web interativa desenvolvida com Inteligência Artificial e Visão Computacional para análise biomecânica e avaliação da execução de exercícios físicos em tempo real.

O projeto utiliza a biblioteca **Google MediaPipe Pose Landmarker** combinada com fundamentos de matemática vetorial e trigonometria espacial para rastrear 33 pontos anatômicos corporais, calcular a amplitude de ângulos articulares e avaliar a qualidade biomecânica dos movimentos efetuados pelo usuário diante de uma câmera.

---

## Contexto FEC - UNIARA

Este aplicativo foi desenvolvido especialmente para apresentação na **Feira de Cursos (FEC)** da **UNIARA (Universidade de Araraquara)**. 

O objetivo do estande é demonstrar na prática como conceitos interdisciplinares de Engenharia de Software, Ciência da Computação, Inteligência Artificial, Educação Física e Fisioterapia se unem para criar soluções tecnológicas acessíveis e de alto impacto no cotidiano esportivo e de reabilitação física.

Durante a feira, o público poderá interagir com a aplicação ao vivo, executando movimentos em frente à webcam e recebendo feedback imediato na tela.

---

## Caso de Uso: Análise da Rosca Direta

Na fase atual de testes, o foco demonstrativo principal é o exercício de **Rosca Direta (Flexão de Cotovelo com Halter/Barra)**:

1. **Rastreamento de Articulações**: Monitoramento contínuo dos pontos anatômicos do Ombro (11/12), Cotovelo (13/14) e Pulso (15/16).
2. **Ângulo de Flexão do Cotovelo**: Cálculo em tempo real do ângulo articular entre os vetores `V_ombro_cotovelo` e `V_cotovelo_pulso`.
3. **Fases do Movimento**:
   - **Fase Excêntrica (Extensão Completa)**: Ângulo articular entre ~150° e ~175°.
   - **Fase Concêntrica (Flexão Máxima)**: Ângulo articular entre ~35° e ~50°.
4. **Indicador de Completude (%)**: Mapeamento do arco de movimento transformado em uma barra de progresso visual de 0% a 100% de amplitude percorrida por repetição.

---

## Tecnologias Utilizadas

| Tecnologia | Descrição | Ícone |
| :--- | :--- | :---: |
| **JavaScript (ES6+)** | Linguagem principal estruturada em módulos nativos (ESM) | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/javascript.png" width="30" height="30" alt="JavaScript" /> |
| **HTML5 Canvas 2D** | Pipeline de renderização gráfica para esqueleto, vetores e arcos | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/html.png" width="30" height="30" alt="HTML5" /> |
| **CSS3** | Estilização responsiva com foco em acessibilidade e alto contraste | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/css.png" width="30" height="30" alt="CSS3" /> |
| **Vite** | Bundler e servidor de desenvolvimento para módulos ES | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/vite.png" width="30" height="30" alt="Vite" /> |
| **Node.js** | Ambiente de execução para gerenciamento de dependências | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/node_js.png" width="30" height="30" alt="Node.js" /> |
| **MediaPipe Tasks Vision** | Engine de inteligência artificial e visão computacional em WebAssembly | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/javascript.png" width="30" height="30" alt="MediaPipe" /> |
| **Git / GitHub** | Controle de versão e repositório de código-fonte | <img src="https://raw.githubusercontent.com/marwin1991/profile-technology-icons/refs/heads/main/icons/git.png" width="30" height="30" alt="Git" /> |

---

## Arquitetura de Módulos

O código-fonte está organizado no diretório `src/` em módulos desacoplados:

```
src/
├── main.js                   # Ponto de entrada, ciclo de vida da aplicação e manipulação do DOM
├── poseLandmarkerService.js  # Abstração do MediaPipe PoseLandmarker (WASM, GPU/CPU fallback)
├── vectorMath.js             # Kernel de cálculos vetoriais, produto escalar e ângulos articulares
├── drawingRenderer.js        # Engine de desenho no Canvas HTML5 com padrão de alto contraste
└── style.css                 # Sistema de estilos com suporte a temas escuros e acessibilidade WCAG
```

### Detalhamento dos Componentes

1. **`src/poseLandmarkerService.js`**
   - Gerencia a inicialização assíncrona dos binários WebAssembly (`FilesetResolver`).
   - Carrega o modelo de aprendizado profundo `pose_landmarker_heavy.task`.
   - Implementa tentativa dinâmica de aceleração por GPU (`GPU delegate`) com fallback automático para CPU em dispositivos não compatíveis.
   - Suporta alteração dinâmica do modo de execução entre `VIDEO` e `IMAGE`.

2. **`src/vectorMath.js`**
   - Define a constante `LANDMARK_NAMES` com os 33 pontos anatômicos.
   - `calculateVector(pA, pB, is3D)`: Computa o vetor direcional no espaço 2D ou 3D.
   - `calculateAngle(pA, pB, pC, is3D)`: Determina o ângulo articular em graus com trigonometria vetorial.
   - `calculateKeyJointAngles(landmarks, is3D)`: Extrai os ângulos-chave de cotovelos, joelhos e ombros.

3. **`src/drawingRenderer.js`**
   - Renderiza em tempo real o esqueleto, vetores direcionais (setas), arcos angulares e caixas telemétricas de alto contraste.

4. **`src/main.js`**
   - Controla o fluxo de dados da câmera/vídeo, cálculo de FPS, atualização da tabela de coordenadas e loop de inferência.

---

## Funcionalidades Técnicas

- **Rastreamento de 33 Landmarks de Pose**: Detecção tridimensional dos pontos corporais.
- **Inspeção Biométrica em Tempo Real**: Tabela com coordenadas normalizadas (X, Y, Z) e percentual de visibilidade de cada ponto.
- **Telemetria Angular**: Cálculo contínuo dos ângulos das principais articulações.
- **Múltiplos Modos de Captura**: Suporte a webcam ao vivo, upload de arquivos de vídeo e fotos estáticas.
- **Aceleração Hardware**: Processamento WebGL/WASM 100% local com baixa latência.

---

## Métricas de Completude e Repetição

Para proporcionar uma experiência didática e atraente na FEC - UNIARA, o sistema prevê:

- **Gráfico / Barra de Completude da Repetição (%)**: Medidor dinâmico que varia de 0% a 100% conforme a amplitude do movimento de rosca direta é realizada.
- **Contador de Repetições Válidas**: Algoritmo de máquina de estados que contabiliza uma repetição concluída ao atingir o pico de flexão e retornar à extensão completa.
- **Indicador de Fase do Exercício**: Feedback visual apontando o estado atual (*Subida / Flexão Concêntrica* ou *Descida / Extensão Excêntrica*).

---

## Requisitos de Ambiente

Para executar o projeto localmente:

- **Node.js**: Versão 18.0.0 ou superior.
- **npm**: Versão 9.0.0 ou superior (acompanha o Node.js).
- Navegador moderno com suporte a WebGL e WebAssembly (Google Chrome, Microsoft Edge, Mozilla Firefox ou Safari).

---

## Instalação e Execução

### 1. Clonar o Repositório

```bash
git clone https://github.com/usuario/fisioplus-pose-landmarker.git
cd fisioplus-pose-landmarker
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor local estará acessível no endereço: `http://localhost:3000/`.

### 4. Gerar Build de Produção

```bash
npm run build
```

Os arquivos otimizados serão gerados no diretório `dist/`.

### 5. Visualizar o Build de Produção Localmente

```bash
npm run preview
```

---

## Configuração do Modelo MediaPipe

- **Arquivo do Modelo**: `pose_landmarker_heavy.task`
- **Localização**: Raiz do projeto / diretório público (`public/`).
- **Parâmetros Padrão de Confiança**:
  - `minPoseDetectionConfidence`: 0.5 (50%)
  - `minPosePresenceConfidence`: 0.5 (50%)
  - `minTrackingConfidence`: 0.5 (50%)
  - `delegate`: `GPU` (com fallback para `CPU`)

---

## Licença

Este projeto é disponibilizado sob a licença MIT. Consulte o arquivo `LICENSE` para mais detalhes.

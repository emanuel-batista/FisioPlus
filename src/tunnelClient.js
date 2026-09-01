export function getTunnelDefaultUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:4010`;
}

export function setupTunnelClient() {
  const urlParams = new URLSearchParams(window.location.search);
  const explicitTunnel = urlParams.get("tunnel");
  const tunnelUrl = explicitTunnel ? (explicitTunnel.startsWith("ws") ? explicitTunnel : `ws://${explicitTunnel}`) : getTunnelDefaultUrl();

  let socket = null;
  let isConnected = false;

  function sendAction(action, payload = null) {
    try {
      const event = new CustomEvent("fisioplus:control", {
        detail: { action, payload }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.warn("Erro ao disparar comando local do túnel:", error);
    }
  }

  function sendState(state) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({
          type: "gameState",
          state
        }));
      } catch (err) {
        // Ignora falha de envio silenciosamente
      }
    }
  }

  function connect() {
    try {
      socket = new WebSocket(tunnelUrl);
    } catch (error) {
      console.warn("Falha ao inicializar WebSocket do túnel:", error);
      return;
    }

    socket.addEventListener("open", () => {
      isConnected = true;
      console.info("🎮 [FisioPlus] Conectado ao túnel de controle do estande:", tunnelUrl);
      // Autentica o cliente do jogo automaticamente
      socket.send(JSON.stringify({
        type: "auth",
        password: "FisioPlus123%",
        source: "game-client"
      }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "authResult" && payload.ok) {
          window.dispatchEvent(new CustomEvent("fisioplus:tunnel_connected"));
        } else if (payload?.type === "action" && payload.action) {
          sendAction(payload.action, payload.payload);
        }
      } catch (error) {
        console.warn("Mensagem recebida do túnel com formato inválido:", error);
      }
    });

    socket.addEventListener("close", () => {
      isConnected = false;
      console.warn("Túnel de controle desconectado. Tentando reconexão em 2s...");
      setTimeout(connect, 2000);
    });

    socket.addEventListener("error", () => {
      isConnected = false;
    });
  }

  connect();

  return {
    sendAction,
    sendState,
    connect,
    isConnected: () => isConnected,
    getSocket: () => socket
  };
}

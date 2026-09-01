import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.CONTROL_PORT || 4010);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'FisioPlus123%';

// Armazena tokens de sessão válidos gerados pelo servidor
const validTokens = new Set();
const clients = new Set();

const ACTIONS = [
  'startGame',
  'resetGame',
  'nextParticipant',
  'goToStart',
  'goToChallenge',
  'debug',
  'debugOn',
  'debugOff',
  'debugToggle',
  'simRep',
  'simWin',
  'addRep',
  'removeRep',
  'togglePlay',
  'toggleAutocam',
  'toggleSidebar',
  'setModelLite',
  'setModelFull',
  'setModelHeavy'
];

let lastKnownGameState = {
  screen: 'start',
  reps: 0,
  target: 10,
  accuracy: 100,
  isDebug: false,
  isRunning: false,
  statusText: 'Aguardando início...'
};

const panelHtml = fs.readFileSync(path.join(__dirname, 'control-panel.html'), 'utf8');

function generateSessionToken() {
  const token = crypto.randomBytes(24).toString('hex');
  validTokens.add(token);
  return token;
}

function validateCredentials(password, token) {
  if (token && validTokens.has(token)) {
    return { valid: true, token };
  }
  if (password && password === ADMIN_PASSWORD) {
    const newToken = generateSessionToken();
    return { valid: true, token: newToken };
  }
  return { valid: false, token: null };
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

function countAuthenticatedClients() {
  let count = 0;
  for (const client of clients) {
    if (client.readyState === 1 && client.isAuthenticated) {
      count++;
    }
  }
  return count;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(panelHtml);
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'fisioplus-control-tunnel',
      actions: ACTIONS,
      port: PORT,
      authRequired: true,
      authenticatedOperators: countAuthenticatedClients(),
      gameState: lastKnownGameState
    }));
    return;
  }

  if (url.pathname === '/api/auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const auth = validateCredentials(data?.password, data?.token);
        if (auth.valid) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, token: auth.token, message: 'Autenticado com sucesso!' }));
          return;
        }
      } catch (err) {}
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Senha incorreta.' }));
    });
    return;
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const authHeader = req.headers.authorization?.replace('Bearer ', '');
        const auth = validateCredentials(data?.password, data?.token || authHeader);

        if (!auth.valid) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Acesso não autorizado. Autentique-se primeiro.' }));
          return;
        }

        if (data?.action) {
          broadcast({ type: 'action', action: data.action, payload: data.payload });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, action: data.action }));
          return;
        }
      } catch (err) {}
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Ação inválida.' }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  socket.isAuthenticated = false;
  clients.add(socket);

  // Solicita autenticação ao novo cliente
  socket.send(JSON.stringify({
    type: 'authRequired',
    message: 'Autenticação necessária para controlar o FisioPlus.',
    actions: ACTIONS
  }));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      // Tentativa de autenticação (senha ou token persistido)
      if (message?.type === 'auth') {
        const auth = validateCredentials(message.password, message.token);
        if (auth.valid) {
          socket.isAuthenticated = true;
          socket.token = auth.token;
          socket.source = message.source || 'operator';

          socket.send(JSON.stringify({
            type: 'authResult',
            ok: true,
            token: auth.token,
            message: 'Acesso autorizado ao estande!',
            gameState: lastKnownGameState,
            actions: ACTIONS
          }));

          broadcastOperatorCount();
          return;
        } else {
          socket.send(JSON.stringify({
            type: 'authResult',
            ok: false,
            error: 'Senha incorreta. Digite novamente.'
          }));
          return;
        }
      }

      // Se não autenticado, bloqueia comandos
      if (!socket.isAuthenticated) {
        socket.send(JSON.stringify({
          type: 'authRequired',
          error: 'Comando rejeitado: sessão não autenticada.'
        }));
        return;
      }

      if (message?.type === 'hello') {
        socket.send(JSON.stringify({
          type: 'status',
          ok: true,
          message: 'Sessão ativa e sincronizada.',
          actions: ACTIONS,
          gameState: lastKnownGameState
        }));
        return;
      }

      if (message?.type === 'gameState') {
        lastKnownGameState = { ...lastKnownGameState, ...message.state };
        broadcast(message);
        return;
      }

      if (message?.type === 'action') {
        broadcast(message);
        return;
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', message: 'Mensagem JSON inválida.' }));
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    broadcastOperatorCount();
  });
});

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1 && client.isAuthenticated) {
      client.send(message);
    }
  }
}

function broadcastOperatorCount() {
  const count = countAuthenticatedClients();
  const payload = JSON.stringify({
    type: 'operatorsCount',
    count: Math.max(1, count)
  });
  for (const client of clients) {
    if (client.readyState === 1 && client.isAuthenticated) {
      client.send(payload);
    }
  }
}

async function openPublicTunnel(port) {
  try {
    const localtunnel = (await import('localtunnel')).default;
    const tunnel = await localtunnel({ port });
    console.log(`🌍 TÚNEL PÚBLICO GLOBAL (Acesso de qualquer 4G/5G/Internet):`);
    console.log(`👉 Link Direto:   ${tunnel.url}/`);
    console.log(`ℹ️  Disponível globalmente com a senha: ${ADMIN_PASSWORD}`);
    console.log(`======================================================\n`);

    tunnel.on('close', () => {
      console.warn('Túnel público global desconectado.');
    });
    return tunnel;
  } catch (err) {
    console.warn('⚠️ Não foi possível abrir o túnel público automático:', err.message);
    console.log('Você pode usar ngrok ou cloudflared manualmente se preferir: npx untun tunnel 4010');
  }
}

server.listen(PORT, HOST, async () => {
  const isPublic = process.argv.includes('--public') || process.env.PUBLIC_TUNNEL === 'true';
  const localIps = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`🔒 [FisioPlus] Túnel Seguro Ativo na Porta ${PORT}`);
  console.log(`🔑 Senha de Acesso: ${ADMIN_PASSWORD}`);
  console.log(`🌐 Aberto para Qualquer Rede com Persistência`);
  console.log(`------------------------------------------------------`);
  console.log(`💻 Acesso no PC:         http://localhost:${PORT}/`);
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log(`📱 Acesso Wi-Fi Local:   http://${ip}:${PORT}/`);
    });
  }

  if (isPublic) {
    console.log(`------------------------------------------------------`);
    console.log(`⏳ Gerando URL Pública Global para 4G/5G...`);
    await openPublicTunnel(PORT);
  } else {
    console.log(`💡 Para acesso via 4G/5G fora do Wi-Fi, execute:`);
    console.log(`   npm run tunnel:public`);
    console.log(`======================================================\n`);
  }
});

export function emitAction(action, payload = null) {
  broadcast({ type: 'action', action, payload });
}

export { server, wss, openPublicTunnel };




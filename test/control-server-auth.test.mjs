import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

test('control-server authentication and multi-operator persistence', async () => {
  process.env.CONTROL_PORT = '4099';
  process.env.ADMIN_PASSWORD = 'FisioPlus123%';
  
  const { server, wss } = await import('../server/control-server.js');
  await new Promise(resolve => setTimeout(resolve, 300));

  const client1 = new WebSocket('ws://localhost:4099');
  let sessionToken = null;

  await new Promise((resolve) => {
    client1.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'authRequired') {
        client1.send(JSON.stringify({ type: 'auth', password: 'FisioPlus123%' }));
      } else if (data.type === 'authResult') {
        assert.equal(data.ok, true);
        assert.ok(data.token);
        sessionToken = data.token;
        resolve();
      }
    });
  });

  const client2 = new WebSocket('ws://localhost:4099');
  await new Promise((resolve) => {
    client2.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'authRequired') {
        client2.send(JSON.stringify({ type: 'auth', token: sessionToken }));
      } else if (data.type === 'authResult') {
        assert.equal(data.ok, true);
        resolve();
      }
    });
  });

  const actionPromise = new Promise((resolve) => {
    client2.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'action' && data.action === 'addRep') {
        resolve();
      }
    });
  });

  client1.send(JSON.stringify({ type: 'action', action: 'addRep' }));
  await actionPromise;

  const badClient = new WebSocket('ws://localhost:4099');
  await new Promise((resolve) => {
    badClient.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'authRequired') {
        badClient.send(JSON.stringify({ type: 'auth', password: 'senha-errada' }));
      } else if (data.type === 'authResult') {
        assert.equal(data.ok, false);
        resolve();
      }
    });
  });

  client1.close();
  client2.close();
  badClient.close();
  wss.close();
  server.close();
});

// realtime/websocket.js - WebSocket setup for development

const { WebSocketServer } = require('ws');
const { getBoothState, updateBoothState } = require('../booth/state');
const { addBoothClient, removeBoothClient, getBoothClients } = require('../booth/broadcast');

let dashboardClients = [];

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    if (req.url === '/booth-ws') {
      addBoothClient(ws);
      console.log('Booth tengdist');
      ws.send(JSON.stringify({ type: 'state', ...getBoothState() }));
      ws.on('close', () => {
        removeBoothClient(ws);
        console.log('Booth aftengdist');
      });
    } else if (req.url === '/dashboard-ws') {
      dashboardClients.push(ws);
      console.log('Dashboard tengdist');
      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === 'handrit') {
            // Store verkefniId in state for live updates
            updateBoothState({
              ...data,
              verkefniId: data.verkefniId || null,
            });
            const boothClients = getBoothClients();
            boothClients.forEach((c) => {
              if (c.readyState === 1) c.send(JSON.stringify(data));
            });
          }
        } catch (err) {
          // Ignore parse errors
        }
      });
      ws.on('close', () => {
        dashboardClients = dashboardClients.filter((c) => c !== ws);
      });
    }
  });

  return wss;
}

module.exports = { setupWebSocket };

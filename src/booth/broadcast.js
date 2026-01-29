// booth/broadcast.js - Broadcast to booth clients

const config = require('../config');
const { updateBoothState } = require('./state');

let boothClients = [];
let boothChannel = null;

function setBoothClients(clients) {
  boothClients = clients;
}

function getBoothClients() {
  return boothClients;
}

function addBoothClient(client) {
  boothClients.push(client);
}

function removeBoothClient(client) {
  boothClients = boothClients.filter(c => c !== client);
}

function setBoothChannel(channel) {
  boothChannel = channel;
}

// Broadcast to booth - works in both dev (WebSocket) and prod (Ably)
async function broadcastToBooth(data) {
  if (data.type === 'handrit' || data.type === 'settings') {
    updateBoothState(data);
  }

  if (config.isProduction && boothChannel) {
    // Production: publish to Ably (must await for serverless!)
    try {
      await boothChannel.publish('message', data);
      console.log('Ably publish success');
    } catch (err) {
      console.error('Ably publish error:', err);
      throw err;
    }
  } else {
    // Development: use WebSocket
    boothClients.forEach((c) => {
      if (c.readyState === 1) c.send(JSON.stringify(data));
    });
  }
}

module.exports = {
  setBoothClients,
  getBoothClients,
  addBoothClient,
  removeBoothClient,
  setBoothChannel,
  broadcastToBooth
};

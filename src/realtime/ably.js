// realtime/ably.js - Ably setup for production

const config = require('../config');
const { setBoothChannel } = require('../booth/broadcast');

let ablyRest = null;
let boothChannel = null;

function setupAbly() {
  if (!config.isProduction || !config.ablyApiKey) {
    return null;
  }

  const Ably = require('ably');
  ablyRest = new Ably.Rest(config.ablyApiKey);
  boothChannel = ablyRest.channels.get('booth');
  setBoothChannel(boothChannel);
  console.log('Ably initialized for production');

  return { ablyRest, boothChannel };
}

function getAblyRest() {
  return ablyRest;
}

function getBoothChannel() {
  return boothChannel;
}

module.exports = { setupAbly, getAblyRest, getBoothChannel };

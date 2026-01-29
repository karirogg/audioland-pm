// connection.js - WebSocket/Ably connection and Google Docs polling

let ws = null;
let ably = null;
let boothChannel = null;
let useAbly = false;
let reconnectInterval = null;
let googleDocPollInterval = null;

// Initialize connection based on environment
async function initConnection(options = {}) {
  const { onMessage, onConnected, onDisconnected, wsPath = '/dashboard-ws' } = options;

  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    useAbly = config.useAbly;

    if (useAbly) {
      console.log('Using Ably for real-time connection');
      await connectAbly({ onMessage, onConnected, onDisconnected });
    } else {
      console.log('Using WebSocket for real-time connection');
      connectWebSocket({ onMessage, onConnected, onDisconnected, wsPath });
    }
  } catch (err) {
    console.error('Config fetch failed, falling back to WebSocket:', err);
    connectWebSocket({ onMessage, onConnected, onDisconnected, wsPath });
  }
}

// Ably connection (production)
async function connectAbly(options = {}) {
  const { onMessage, onConnected, onDisconnected } = options;

  try {
    // Ably SDK must be loaded globally
    if (typeof Ably === 'undefined') {
      console.error('Ably SDK not loaded');
      return;
    }

    ably = new Ably.Realtime({
      authCallback: (params, callback) => {
        fetch('/api/ably-token')
          .then(res => res.json())
          .then(token => callback(null, token))
          .catch(err => callback(err, null));
      }
    });

    ably.connection.on('connected', async () => {
      console.log('Ably connected');
      if (onConnected) onConnected('Ably');

      // Get initial state
      try {
        const stateRes = await fetch('/api/booth/state');
        const state = await stateRes.json();
        if (state.handrit && onMessage) {
          onMessage({ type: 'state', ...state });
        }
      } catch (err) {
        console.error('Failed to fetch initial state:', err);
      }
    });

    ably.connection.on('disconnected', () => {
      console.log('Ably disconnected');
      if (onDisconnected) onDisconnected();
    });

    ably.connection.on('failed', (err) => {
      console.error('Ably connection failed:', err);
      if (onDisconnected) onDisconnected();
    });

    // Subscribe to booth channel
    boothChannel = ably.channels.get('booth');
    boothChannel.subscribe('message', (message) => {
      if (onMessage) onMessage(message.data);
    });

  } catch (err) {
    console.error('Ably init failed:', err);
  }
}

// WebSocket connection (development)
function connectWebSocket(options = {}) {
  const { onMessage, onConnected, onDisconnected, wsPath = '/dashboard-ws' } = options;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}${wsPath}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    if (onConnected) onConnected('WebSocket');

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    if (onDisconnected) onDisconnected();

    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket(options);
      }, 3000);
    }
  };

  ws.onerror = (err) => console.error('WebSocket error:', err);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (onMessage) onMessage(data);
  };
}

// Send message via WebSocket or HTTP POST (for Ably)
async function sendToBooth(data) {
  if (useAbly) {
    // Production: use HTTP POST (server will broadcast via Ably)
    const res = await fetch('/api/booth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.ok;
  } else {
    // Development: use WebSocket
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
}

// Check if connection is ready
function isConnected() {
  if (useAbly) {
    return ably && ably.connection.state === 'connected';
  } else {
    return ws && ws.readyState === 1;
  }
}

// Google Docs polling
function startGoogleDocPolling(docId, onUpdate) {
  stopGoogleDocPolling();
  if (!docId) return;

  googleDocPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/google-doc/${docId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.content && onUpdate) {
          onUpdate(data.content);
        }
      }
    } catch (err) {
      console.error('Error fetching Google Doc:', err);
    }
  }, 3000);
}

function stopGoogleDocPolling() {
  if (googleDocPollInterval) {
    clearInterval(googleDocPollInterval);
    googleDocPollInterval = null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initConnection,
    sendToBooth,
    isConnected,
    startGoogleDocPolling,
    stopGoogleDocPolling
  };
}

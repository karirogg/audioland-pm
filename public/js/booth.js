// booth.js - Booth page logic

let ws;
let ably;
let boothChannel;
let reconnectInterval;
let autoScrollInterval = null;
let currentFontSize = 2;
let autoScrollActive = false;
let scrollSpeed = 50;
let googleDocId = null;
let googleDocPollInterval = null;
let isLeftAligned = false;
let useAbly = false;
let currentTake = 1;
let isMirrored = false;

async function initConnection() {
  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    useAbly = config.useAbly;

    if (useAbly) {
      console.log('Using Ably for real-time connection');
      connectAbly();
    } else {
      console.log('Using WebSocket for real-time connection');
      connectWebSocket();
    }
  } catch (err) {
    console.error('Config fetch failed, falling back to WebSocket:', err);
    connectWebSocket();
  }
}

async function connectAbly() {
  try {
    if (typeof Ably === 'undefined') {
      console.error('Ably SDK not loaded');
      return;
    }

    ably = new Ably.Realtime({
      authCallback: (params, callback) => {
        fetch('/api/ably-token')
          .then((res) => res.json())
          .then((token) => callback(null, token))
          .catch((err) => callback(err, null));
      },
    });

    ably.connection.on('connected', async () => {
      console.log('Ably tengdist');
      document.getElementById('statusDot').classList.add('connected');
      document.getElementById('statusText').textContent = 'Tengt (Ably)';

      try {
        const stateRes = await fetch('/api/booth/state');
        const state = await stateRes.json();
        if (state.handrit) {
          handleMessage({ type: 'state', ...state });
        }
      } catch (err) {
        console.error('Failed to fetch initial state:', err);
      }
    });

    ably.connection.on('disconnected', () => {
      console.log('Ably aftengt');
      document.getElementById('statusDot').classList.remove('connected');
      document.getElementById('statusText').textContent = 'Aftengt...';
    });

    ably.connection.on('failed', (err) => {
      console.error('Ably connection failed:', err);
      document.getElementById('statusDot').classList.remove('connected');
      document.getElementById('statusText').textContent = 'Tenging mist\u00f3kst';
    });

    boothChannel = ably.channels.get('booth');
    boothChannel.subscribe('message', (message) => {
      handleMessage(message.data);
    });
  } catch (err) {
    console.error('Ably init failed:', err);
    document.getElementById('statusText').textContent = 'Villa vi\u00f0 Ably tengingu';
  }
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/booth-ws`);

  ws.onopen = () => {
    console.log('WebSocket tengdist');
    document.getElementById('statusDot').classList.add('connected');
    document.getElementById('statusText').textContent = 'Tengt';
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };

  ws.onclose = () => {
    console.log('WebSocket aftengt');
    document.getElementById('statusDot').classList.remove('connected');
    document.getElementById('statusText').textContent = 'Aftengt - reyni aftur...';

    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        console.log('Reyni a\u00f0 tengjast aftur...');
        connectWebSocket();
      }, 3000);
    }
  };

  ws.onerror = (err) => console.error('WebSocket villa:', err);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };
}

function handleMessage(data) {
  switch (data.type) {
    case 'handrit':
      showHandrit(data);
      break;
    case 'state':
      if (data.handrit) showHandrit(data);
      if (data.fontSize) setFontSize(data.fontSize, false);
      if (data.autoScroll) {
        autoScrollActive = true;
        scrollSpeed = data.scrollSpeed || 50;
        startAutoScroll();
      }
      break;
    case 'take':
      updateTake(data.take);
      break;
    case 'settings':
      if (data.fontSize) setFontSize(data.fontSize, false);
      if (typeof data.autoScroll !== 'undefined') {
        if (data.autoScroll) {
          scrollSpeed = data.scrollSpeed || scrollSpeed;
          startAutoScroll();
        } else {
          stopAutoScroll();
        }
      }
      break;
    case 'scroll-toggle':
      toggleAutoScroll();
      break;
    case 'scroll-start':
      if (!autoScrollActive) startAutoScroll();
      break;
    case 'scroll-stop':
      if (autoScrollActive) stopAutoScroll();
      break;
    case 'hreinsa':
      showStandby();
      break;
  }
}

function showHandrit(data) {
  document.getElementById('standby').classList.add('hidden');
  document.getElementById('handritView').classList.add('active');
  document.getElementById('centerLine').style.display = 'block';

  document.getElementById('verkefniNafn').textContent = data.nafn || '';
  document.getElementById('handritText').textContent = data.handrit || '';
  document.getElementById('lesariNafn').textContent = data.lesari
    ? `Lesari: ${data.lesari}`
    : '';

  currentTake = data.take || 1;
  document.getElementById('takeNumber').textContent = currentTake;
  document.getElementById('takeDisplay').textContent = currentTake;

  setFontSize(data.fontSize || 2);

  if (data.autoScroll) {
    scrollSpeed = data.scrollSpeed || 50;
    startAutoScroll();
  }

  if (data.googleDocId) {
    googleDocId = data.googleDocId;
    startGoogleDocPolling();
  } else {
    googleDocId = null;
    stopGoogleDocPolling();
  }

  scrollToTop();
}

function startGoogleDocPolling() {
  stopGoogleDocPolling();
  const docId = googleDocId;
  if (!docId) return;

  googleDocPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/google-doc/${docId}`);
      const data = await res.json();
      if (data.content) {
        const currentText = document.getElementById('handritText').textContent;
        if (data.content !== currentText) {
          document.getElementById('handritText').textContent = data.content;
        }
      }
    } catch (err) {
      console.error('Villa vi\u00f0 a\u00f0 s\u00e6kja Google Doc:', err);
    }
  }, 3000);
}

function stopGoogleDocPolling() {
  if (googleDocPollInterval) {
    clearInterval(googleDocPollInterval);
    googleDocPollInterval = null;
  }
}

function updateTake(take) {
  document.getElementById('takeNumber').textContent = take;
}

function showStandby() {
  document.getElementById('standby').classList.remove('hidden');
  document.getElementById('handritView').classList.remove('active');
  document.getElementById('centerLine').style.display = 'none';
  stopAutoScroll();
  stopGoogleDocPolling();
}

function setFontSize(size, sendToServer = true) {
  currentFontSize = size;
  const content = document.getElementById('handritContent');
  content.className = 'handrit-content font-size-' + size;
  if (isLeftAligned) content.querySelector('.handrit-text').classList.add('align-left');

  for (let i = 1; i <= 4; i++) {
    document.getElementById('fontBtn' + i).classList.remove('active');
  }
  document.getElementById('fontBtn' + size).classList.add('active');
}

function toggleAlign() {
  isLeftAligned = !isLeftAligned;
  const text = document.getElementById('handritText');
  const btn = document.getElementById('alignBtn');

  if (isLeftAligned) {
    text.classList.add('align-left');
    btn.textContent = '\u2261 Vinstri';
    btn.classList.add('active');
  } else {
    text.classList.remove('align-left');
    btn.textContent = '\u2261 Mi\u00f0ja';
    btn.classList.remove('active');
  }
}

function toggleAutoScroll() {
  if (autoScrollActive) {
    stopAutoScroll();
  } else {
    startAutoScroll();
  }
}

function startAutoScroll() {
  autoScrollActive = true;
  document.getElementById('autoScrollBtn').classList.add('active');
  document.getElementById('scrollIndicator').classList.add('active');

  if (autoScrollInterval) clearInterval(autoScrollInterval);

  const content = document.getElementById('handritContent');
  const interval = Math.max(5, 150 - scrollSpeed);

  autoScrollInterval = setInterval(() => {
    content.scrollTop += 1;
    if (content.scrollTop >= content.scrollHeight - content.clientHeight) {
      stopAutoScroll();
    }
  }, interval);
}

function stopAutoScroll() {
  autoScrollActive = false;
  document.getElementById('autoScrollBtn').classList.remove('active');
  document.getElementById('scrollIndicator').classList.remove('active');

  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

function scrollToTop() {
  document.getElementById('handritContent').scrollTop = 0;
}

function changeSpeed(delta) {
  scrollSpeed = Math.max(10, Math.min(300, scrollSpeed + delta));
  document.getElementById('speedDisplay').textContent = scrollSpeed;

  if (autoScrollActive) {
    stopAutoScroll();
    startAutoScroll();
  }
}

function changeTake(delta) {
  currentTake = Math.max(1, currentTake + delta);
  document.getElementById('takeDisplay').textContent = currentTake;
  document.getElementById('takeNumber').textContent = currentTake;
}

function toggleMirror() {
  isMirrored = !isMirrored;
  const content = document.getElementById('handritContent');
  const btn = document.getElementById('mirrorBtn');

  if (isMirrored) {
    content.classList.add('mirrored');
    btn.classList.add('active');
  } else {
    content.classList.remove('mirrored');
    btn.classList.remove('active');
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

async function fetchBoothState() {
  const btn = document.getElementById('refreshBtn');
  btn.textContent = '\u23f3';
  try {
    const res = await fetch('/api/booth/state');
    const state = await res.json();
    if (state.handrit) {
      handleMessage({ type: 'state', ...state });
      btn.textContent = '\u2713';
    } else {
      btn.textContent = '\u2014';
    }
  } catch (err) {
    console.error('Villa vi\u00f0 a\u00f0 s\u00e6kja state:', err);
    btn.textContent = '\u2717';
  }
  setTimeout(() => {
    btn.textContent = '\ud83d\udd04';
  }, 1500);
}

// Dark mode with booth-specific storage key
function initBoothDarkMode() {
  const saved = localStorage.getItem('booth-dark-mode');
  if (saved === 'true') {
    isDarkMode = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    updateBoothDarkModeBtn();
  }
}

function toggleBoothDarkMode() {
  isDarkMode = !isDarkMode;
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('booth-dark-mode', isDarkMode);
  updateBoothDarkModeBtn();
}

function updateBoothDarkModeBtn() {
  const btn = document.getElementById('darkModeBtn');
  if (isDarkMode) {
    btn.textContent = '\u263e D\u00f6kkt';
    btn.classList.add('active');
  } else {
    btn.textContent = '\u2600 Lj\u00f3st';
    btn.classList.remove('active');
  }
}

// Use booth-specific dark mode
let isDarkMode = false;

// Initialize
initBoothDarkMode();
initConnection();

// index.js - Dashboard page logic

let verkefni = [];
let currentFilter = 'all';
let currentView = 'grid';
let currentTimeType = 'timi';
let isLoadingProject = false;
let tempTimaSkraningar = [];
let tempAdkeypt = [];
let tempLotur = [];
let ws = null;
let saveTimeout = null;
let currentVerkefniId = null;
let useAbly = false;
let googleDocPollInterval = null;

async function initConnection() {
  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    useAbly = config.useAbly;

    if (useAbly) {
      console.log('Using Ably mode - dashboard will use HTTP POST to send to booth');
    } else {
      console.log('Using WebSocket mode for development');
      connectWS();
    }
  } catch (err) {
    console.error('Config fetch failed, using WebSocket:', err);
    connectWS();
  }
}

function connectWS() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + window.location.host + '/dashboard-ws');
  ws.onclose = () => setTimeout(connectWS, 3000);
}

async function saekjaVerkefni() {
  try {
    const res = await fetch('/api/verkefni');
    verkefni = await res.json();
    birtaVerkefni();
  } catch (err) {
    console.error(err);
  }
}

async function saekjaStofur() {
  try {
    const res = await fetch('/api/stofur');
    const stofur = await res.json();
    document.getElementById('stofurList').innerHTML = stofur
      .map((s) => '<option value="' + escapeHtml(s.nafn) + '">')
      .join('');
  } catch (err) {}
}

async function saekjaFramleidslu() {
  try {
    const res = await fetch('/api/framleidsla');
    const data = await res.json();
    document.getElementById('framleidslaList').innerHTML = data
      .map((f) => '<option value="' + escapeHtml(f.nafn) + '">')
      .join('');
  } catch (err) {}
}

async function saekjaLesendur() {
  try {
    const res = await fetch('/api/lesendur');
    const data = await res.json();
    document.getElementById('lesendurList').innerHTML = data
      .map((l) => '<option value="' + escapeHtml(l.nafn) + '">')
      .join('');
  } catch (err) {}
}

async function saekjaKunnar() {
  try {
    const res = await fetch('/api/kunnar');
    const data = await res.json();
    document.getElementById('kunnarList').innerHTML = data
      .map((k) => '<option value="' + escapeHtml(k.nafn) + '">')
      .join('');
  } catch (err) {}
}

function birtaVerkefni() {
  const grid = document.getElementById('verkefniGrid');
  const empty = document.getElementById('emptyState');
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = verkefni;
  if (currentFilter !== 'all') filtered = filtered.filter((v) => v.stada === currentFilter);
  if (search)
    filtered = filtered.filter(
      (v) =>
        (v.nafn || '').toLowerCase().includes(search) ||
        (v.lesari || '').toLowerCase().includes(search) ||
        (v.stofa || '').toLowerCase().includes(search) ||
        (v.handrit || '').toLowerCase().includes(search)
    );

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered
    .map((v) => {
      const stadaClass =
        v.stada === '\u00cd vinnslu'
          ? 'stada-vinnslu'
          : v.stada === 'B\u00ed\u00f0ur'
            ? 'stada-bidur'
            : 'stada-lokid';
      const badgeClass =
        v.stada === '\u00cd vinnslu' ? 'vinnslu' : v.stada === 'B\u00ed\u00f0ur' ? 'bidur' : 'lokid';
      const tpiMIn = v.total_minutes || 0;
      const timeDisplay =
        tpiMIn > 0
          ? '<span class="card-time has-time">\u23f1\ufe0f ' + tpiMIn + ' m\u00edn</span>'
          : '<span class="card-time">\u23f1\ufe0f 0 m\u00edn</span>';
      const vnumer = v.verkefnanumer
        ? '<span class="card-number">' + escapeHtml(v.verkefnanumer) + '</span>'
        : '';
      if (currentView === 'list') {
        return (
          '<div class="card ' +
          stadaClass +
          '" onclick="opnaVerkefni(' +
          v.id +
          ')">' +
          '<div class="card-image">' +
          (v.mynd
            ? '<img src="' + v.mynd + '">'
            : '<img class="placeholder" src="AppLogo.png" alt="">') +
          '</div><div class="card-content">' +
          vnumer +
          '<div class="card-title">' +
          escapeHtml(v.nafn) +
          '</div>' +
          '<div class="card-subtitle">' +
          escapeHtml(v.lesari || '\u2014') +
          '</div>' +
          '<div class="card-meta"><div>' +
          escapeHtml(v.stofa || '\u2014') +
          '</div>' +
          timeDisplay +
          '</div>' +
          '<span class="list-status status-badge ' +
          badgeClass +
          '">' +
          escapeHtml(v.stada) +
          '</span>' +
          '<button class="card-booth-btn" onclick="sendaTilBooth(event, ' +
          v.id +
          ')" title="Senda \u00ed Booth">\ud83c\udf99\ufe0f</button>' +
          '</div></div>'
        );
      }
      return (
        '<div class="card ' +
        stadaClass +
        '" onclick="opnaVerkefni(' +
        v.id +
        ')"><div class="card-image">' +
        (v.mynd
          ? '<img src="' + v.mynd + '">'
          : '<img class="placeholder" src="AppLogo.png" alt="">') +
        '<span class="status-badge ' +
        badgeClass +
        '">' +
        escapeHtml(v.stada) +
        '</span></div><div class="card-content">' +
        vnumer +
        '<div class="card-title">' +
        escapeHtml(v.nafn) +
        '</div><div class="card-subtitle">' +
        escapeHtml(v.lesari || 'Enginn lesari') +
        '</div><div class="card-meta"><div>' +
        escapeHtml(v.stofa || '\u2014') +
        '</div>' +
        timeDisplay +
        '</div><button class="card-booth-btn" onclick="sendaTilBooth(event, ' +
        v.id +
        ')" title="Senda \u00ed Booth">\ud83c\udf99\ufe0f</button></div></div>'
      );
    })
    .join('');
}

function setView(view, save = true) {
  currentView = view;
  if (save) localStorage.setItem('bessi-view', view);
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector('.view-btn[onclick="setView(\'' + view + '\')"]').classList.add('active');

  const grid = document.getElementById('verkefniGrid');
  if (view === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }
  birtaVerkefni();
}

function initView() {
  const saved = localStorage.getItem('bessi-view');
  if (saved === 'list') {
    setView('list', false);
  }
}

async function nyttVerkefni() {
  isLoadingProject = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  try {
    const res = await fetch('/api/verkefni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nafn: 'N\u00fdtt verkefni', stada: '\u00cd vinnslu' }),
    });
    const result = await res.json();
    currentVerkefniId = result.id;

    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalNumber').textContent = '';
    document.getElementById('modalTitle').textContent = 'N\u00fdtt verkefni';
    document.getElementById('stadaHeader').value = '\u00cd vinnslu';
    updateStadaColor('\u00cd vinnslu');
    document.getElementById('opnaBoothBtn').style.display = 'none';
    document.getElementById('eydaBtn').style.display = 'none';
    document.getElementById('verkefniForm').reset();
    document.getElementById('verkefniId').value = currentVerkefniId;
    document.getElementById('nafn').value = 'N\u00fdtt verkefni';
    document.getElementById('myndBase64').value = '';
    document.getElementById('myndPreview').innerHTML = '';
    document.getElementById('saveStatus').textContent = '';
    document.getElementById('handritEditor').innerHTML = '';
    stopGoogleDocPolling();
    tempTimaSkraningar = [];
    tempAdkeypt = [];
    tempLotur = [];
    birtaTimaSkraningar();
    birtaAdkeypt();
    birtaLotur();
    switchTab('grunnur');

    setTimeout(() => {
      const nafnInput = document.getElementById('nafn');
      nafnInput.focus();
      nafnInput.select();
      isLoadingProject = false;
    }, 100);

    saekjaVerkefni();
  } catch (err) {
    console.error(err);
    alert('Villa vi\u00f0 a\u00f0 b\u00faa til verkefni');
    isLoadingProject = false;
  }
}

function lokaModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  currentVerkefniId = null;
  stopGoogleDocPolling();
  saekjaVerkefni();
}

async function eydaVerkefni() {
  if (!currentVerkefniId) return;

  const nafn = document.getElementById('nafn').value || '\u00feetta verkefni';
  if (
    !confirm(
      'Ertu viss um a\u00f0 \u00fe\u00fa viljir ey\u00f0a "' +
        nafn +
        '"?\n\n\u00deetta er ekki h\u00e6gt a\u00f0 afturkalla.'
    )
  ) {
    return;
  }

  try {
    const res = await fetch('/api/verkefni/' + currentVerkefniId, {
      method: 'DELETE',
    });
    if (res.ok) {
      lokaModal();
    } else {
      alert('Villa vi\u00f0 a\u00f0 ey\u00f0a verkefni');
    }
  } catch (err) {
    console.error(err);
    alert('Villa vi\u00f0 a\u00f0 ey\u00f0a verkefni');
  }
}

async function opnaVerkefni(id) {
  isLoadingProject = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  try {
    const res = await fetch('/api/verkefni/' + id);
    const v = await res.json();
    currentVerkefniId = id;

    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalNumber').textContent = v.verkefnanumer || '';
    document.getElementById('modalTitle').textContent = v.nafn || 'Verkefni';
    document.getElementById('stadaHeader').value = v.stada || '\u00cd vinnslu';
    updateStadaColor(v.stada || '\u00cd vinnslu');
    document.getElementById('opnaBoothBtn').style.display = 'inline-flex';
    document.getElementById('eydaBtn').style.display = 'inline-flex';
    document.getElementById('saveStatus').textContent = '';

    document.getElementById('verkefniId').value = v.id;
    [
      'nafn',
      'stada',
      'lesari',
      'lesari_simi',
      'lesari_netfang',
      'mottekid',
      'skilad',
      'payday_tengill',
      'dropbox_slod',
      'athugasemdir',
      'framleidsla',
      'produser',
      'produser_simi',
      'produser_netfang',
      'stofa',
      'tengill_nafn',
      'tengill_simi',
      'tengill_netfang',
      'art_director',
      'art_director_simi',
      'copywriter',
      'copywriter_simi',
      'google_doc_url',
      'handrit',
      'kunni',
      'kunni_tengill',
      'kunni_simi',
      'kunni_netfang',
    ].forEach((f) => {
      const el = document.getElementById(f);
      if (el) el.value = v[f] || '';
    });

    // Sync handrit to editor
    syncHiddenToEditor();

    document.getElementById('myndBase64').value = v.mynd || '';
    if (v.mynd) {
      document.getElementById('myndPreview').innerHTML =
        '<img src="' +
        v.mynd +
        '" style="max-width:150px;max-height:100px;border-radius:8px;">';
    } else {
      document.getElementById('myndPreview').innerHTML = '';
    }

    if (v.google_doc_url) {
      const match = v.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        startGoogleDocPolling(match[1]);
      }
    }

    await saekjaTimaskraningar(v.id);
    await saekjaAdkeypt(v.id);
    await saekjaLotur(v.id);
    switchTab('grunnur');
    isLoadingProject = false;
  } catch (err) {
    console.error(err);
    isLoadingProject = false;
  }
}

function triggerAutosave() {
  if (!currentVerkefniId || isLoadingProject) return;

  document.getElementById('saveStatus').innerHTML = '\u23f3 Vista...';
  document.getElementById('saveStatus').className = 'save-status saving';

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autosave, 500);
}

async function autosave() {
  if (!currentVerkefniId) return;

  const data = {};
  [
    'nafn',
    'stada',
    'lesari',
    'lesari_simi',
    'lesari_netfang',
    'mottekid',
    'skilad',
    'payday_tengill',
    'dropbox_slod',
    'athugasemdir',
    'framleidsla',
    'produser',
    'produser_simi',
    'produser_netfang',
    'stofa',
    'tengill_nafn',
    'tengill_simi',
    'tengill_netfang',
    'art_director',
    'art_director_simi',
    'copywriter',
    'copywriter_simi',
    'google_doc_url',
    'handrit',
    'kunni',
    'kunni_tengill',
    'kunni_simi',
    'kunni_netfang',
  ].forEach((f) => {
    const el = document.getElementById(f);
    if (el) data[f] = el.value;
  });
  // Get stada from header select
  data.stada = document.getElementById('stadaHeader').value;

  const myndBase64 = document.getElementById('myndBase64').value;
  if (myndBase64) data.mynd = myndBase64;

  try {
    await fetch('/api/verkefni/' + currentVerkefniId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    document.getElementById('saveStatus').innerHTML = '\u2713 Vista\u00f0';
    document.getElementById('saveStatus').className = 'save-status saved';
    document.getElementById('modalTitle').textContent = data.nafn || 'Verkefni';

    setTimeout(() => {
      const status = document.getElementById('saveStatus');
      if (status.innerHTML === '\u2713 Vista\u00f0') status.innerHTML = '';
    }, 2000);
  } catch (err) {
    console.error(err);
    document.getElementById('saveStatus').innerHTML = '\u26a0\ufe0f Villa';
    document.getElementById('saveStatus').className = 'save-status';
  }
}

function startGoogleDocPolling(docId) {
  stopGoogleDocPolling();
  if (!docId) return;

  googleDocPollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/google-doc/' + docId);
      if (res.ok) {
        const data = await res.json();
        const currentText = document.getElementById('handrit').value;
        if (data.content && data.content !== currentText) {
          document.getElementById('handrit').value = data.content;
          document.getElementById('handritEditor').innerHTML = data.content;
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

function handleImageUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('myndBase64').value = e.target.result;
      document.getElementById('myndPreview').innerHTML =
        '<img src="' +
        e.target.result +
        '" style="max-width:150px;max-height:100px;border-radius:8px;">';
      triggerAutosave();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function sendaTilBooth(event, verkefniId) {
  event.stopPropagation();
  try {
    const res = await fetch('/api/verkefni/' + verkefniId);
    const v = await res.json();

    let googleDocId = null;
    if (v.google_doc_url) {
      const match = v.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) googleDocId = match[1];
    }

    if (useAbly) {
      await fetch('/api/booth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nafn: v.nafn,
          handrit: v.handrit,
          lesari: v.lesari,
          googleDocId,
          take: 1,
        }),
      });
    } else {
      if (ws && ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'handrit',
            nafn: v.nafn,
            handrit: v.handrit,
            lesari: v.lesari,
            googleDocId,
            take: 1,
          })
        );
      }
    }

    event.target.textContent = '\u2713';
    setTimeout(() => {
      event.target.textContent = '\ud83c\udf99\ufe0f';
    }, 1000);
  } catch (err) {
    console.error(err);
    alert('Villa vi\u00f0 a\u00f0 senda \u00ed booth');
  }
}

async function sendaIBooth(showAlert = false) {
  const nafn = document.getElementById('nafn').value;
  const handrit = document.getElementById('handrit').value;
  const lesari = document.getElementById('lesari').value;
  const googleDocUrl = document.getElementById('google_doc_url').value;
  let googleDocId = null;
  if (googleDocUrl) {
    const match = googleDocUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) googleDocId = match[1];
  }

  if (useAbly) {
    try {
      await fetch('/api/booth/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nafn,
          handrit,
          lesari,
          googleDocId,
          take: 1,
        }),
      });
      if (showAlert) alert('Sent \u00ed booth!');
    } catch (err) {
      console.error('Villa vi\u00f0 a\u00f0 senda \u00ed booth:', err);
      alert('Villa vi\u00f0 a\u00f0 senda \u00ed booth');
    }
  } else {
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: 'handrit',
          nafn,
          handrit,
          lesari,
          googleDocId,
          take: 1,
        })
      );
      if (showAlert) alert('Sent \u00ed booth!');
    } else {
      alert('Ekki tengt vi\u00f0 server');
    }
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

function toggleTimeForm() {
  document.getElementById('timeForm').classList.toggle('active');
  document.getElementById('time_dagsetning').value = new Date().toISOString().split('T')[0];
}

async function saekjaTimaskraningar(verkefniId) {
  try {
    const res = await fetch('/api/verkefni/' + verkefniId + '/timi');
    tempTimaSkraningar = await res.json();
    birtaTimaSkraningar();
  } catch (err) {
    tempTimaSkraningar = [];
    birtaTimaSkraningar();
  }
}

function birtaTimaSkraningar() {
  const container = document.getElementById('timaSkraningar');
  if (tempTimaSkraningar.length === 0) {
    container.innerHTML = '<p style="color: var(--text-dim);">Engar f\u00e6rslur</p>';
    updateTotals();
    return;
  }
  const icons = { timi: '\u23f1\ufe0f', simtal: '\ud83d\udcde', email: '\u2709\ufe0f', fundur: '\ud83d\udcc5' };
  container.innerHTML = tempTimaSkraningar
    .map(
      (t) =>
        '<div class="time-entry"><div class="time-entry-icon">' +
        (icons[t.tegund] || '\ud83d\udcdd') +
        '</div><div class="time-entry-content"><div class="time-entry-title">' +
        escapeHtml(t.titill || t.tegund) +
        '</div><div class="time-entry-meta">' +
        (t.timi_minutur ? t.timi_minutur + ' m\u00edn \u2022 ' : '') +
        formatDate(t.dagsetning) +
        '</div></div><button type="button" class="time-entry-delete" onclick="eydaTima(' +
        t.id +
        ')">\ud83d\uddd1\ufe0f</button></div>'
    )
    .join('');
  updateTotals();
}

function updateTotals() {
  document.getElementById('totalTimi').textContent = tempTimaSkraningar
    .filter((t) => t.tegund === 'timi')
    .reduce((s, t) => s + (t.timi_minutur || 0), 0);
  document.getElementById('totalSimtol').textContent = tempTimaSkraningar.filter(
    (t) => t.tegund === 'simtal'
  ).length;
  document.getElementById('totalEmail').textContent = tempTimaSkraningar.filter(
    (t) => t.tegund === 'email'
  ).length;
  document.getElementById('totalFundir').textContent = tempTimaSkraningar.filter(
    (t) => t.tegund === 'fundur'
  ).length;
}

async function baetaVidTima() {
  if (!currentVerkefniId) {
    alert('Vista verkefni\u00f0 fyrst');
    return;
  }
  const data = {
    tegund: currentTimeType,
    titill: document.getElementById('time_titill').value,
    dagsetning: document.getElementById('time_dagsetning').value,
    timi_minutur: parseInt(document.getElementById('time_minutur').value) || 0,
  };
  try {
    await fetch('/api/verkefni/' + currentVerkefniId + '/timi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    document.getElementById('time_titill').value = '';
    document.getElementById('time_minutur').value = '';
    document.getElementById('timeForm').classList.remove('active');
    await saekjaTimaskraningar(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

async function eydaTima(id) {
  if (!confirm('Ey\u00f0a f\u00e6rslu?')) return;
  try {
    await fetch('/api/timi/' + id, { method: 'DELETE' });
    await saekjaTimaskraningar(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

function toggleMusicForm() {
  document.getElementById('musicForm').classList.toggle('active');
}

async function saekjaAdkeypt(verkefniId) {
  try {
    const res = await fetch('/api/verkefni/' + verkefniId + '/adkeypt');
    tempAdkeypt = await res.json();
    birtaAdkeypt();
  } catch (err) {
    tempAdkeypt = [];
    birtaAdkeypt();
  }
}

function birtaAdkeypt() {
  const container = document.getElementById('adkeyptList');
  if (tempAdkeypt.length === 0) {
    container.innerHTML = '<p style="color: var(--text-dim);">Engin l\u00f6g skr\u00e1\u00f0</p>';
    document.getElementById('musicTotal').style.display = 'none';
    return;
  }

  container.innerHTML = tempAdkeypt
    .map(
      (a) =>
        '<div class="music-item"><div class="music-item-content"><div class="music-item-title">' +
        escapeHtml(a.titill || '\u00d3nefnt') +
        '</div><div class="music-item-meta">' +
        escapeHtml(a.heimild || '') +
        (a.url ? ' \u2022 <a href="' + a.url + '" target="_blank">Tengill</a>' : '') +
        '</div></div><div class="music-item-cost">' +
        (a.kostnadur ? a.kostnadur.toLocaleString('is-IS') + ' kr' : '') +
        '</div><button type="button" class="music-item-delete" onclick="eydaLagi(' +
        a.id +
        ')">\u00d7</button></div>'
    )
    .join('');

  const total = tempAdkeypt.reduce((s, a) => s + (a.kostnadur || 0), 0);
  document.getElementById('musicTotalAmount').textContent = total.toLocaleString('is-IS');
  document.getElementById('musicTotal').style.display = total > 0 ? 'flex' : 'none';
}

async function baetaVidLagi() {
  if (!currentVerkefniId) {
    alert('Vista verkefni\u00f0 fyrst');
    return;
  }
  const data = {
    titill: document.getElementById('music_titill').value,
    heimild: document.getElementById('music_heimild').value,
    url: document.getElementById('music_url').value,
    kostnadur: parseInt(document.getElementById('music_kostnadur').value) || 0,
  };
  try {
    await fetch('/api/verkefni/' + currentVerkefniId + '/adkeypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    document.getElementById('music_titill').value = '';
    document.getElementById('music_heimild').value = '';
    document.getElementById('music_url').value = '';
    document.getElementById('music_kostnadur').value = '';
    document.getElementById('musicForm').classList.remove('active');
    await saekjaAdkeypt(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

async function eydaLagi(id) {
  if (!confirm('Ey\u00f0a lagi?')) return;
  try {
    await fetch('/api/adkeypt/' + id, { method: 'DELETE' });
    await saekjaAdkeypt(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

// Session management functions
async function saekjaLotur(verkefniId) {
  try {
    const res = await fetch('/api/verkefni/' + verkefniId + '/sessions');
    tempLotur = await res.json();
    birtaLotur();
  } catch (err) {
    tempLotur = [];
    birtaLotur();
  }
}

function birtaLotur() {
  const container = document.getElementById('loturList');
  if (tempLotur.length === 0) {
    container.innerHTML = '<p style="color: var(--text-dim);">Engar lotur skráðar</p>';
    return;
  }
  container.innerHTML = tempLotur
    .map(
      (s) =>
        '<div class="time-entry"><div class="time-entry-icon">📅</div>' +
        '<div class="time-entry-content"><div class="time-entry-title">' +
        formatDate(s.dags) + ' kl. ' + (s.timi || '09:00') +
        (s.lesari ? ' - ' + escapeHtml(s.lesari) : '') +
        '</div><div class="time-entry-meta">' +
        (s.lengd || 60) + ' mín' +
        (s.athugasemd ? ' • ' + escapeHtml(s.athugasemd) : '') +
        '</div></div>' +
        '<a href="/api/sessions/' + s.id + '/ics" class="btn btn-ghost btn-small" title="Sækja dagatal" style="margin-right:0.5rem;">📆</a>' +
        '<button type="button" class="time-entry-delete" onclick="eydaLotu(' + s.id + ')">🗑️</button></div>'
    )
    .join('');
}

function toggleSessionForm() {
  document.getElementById('sessionForm').classList.toggle('active');
  document.getElementById('session_dags').value = new Date().toISOString().split('T')[0];
}

async function baetaVidLotu() {
  if (!currentVerkefniId) {
    alert('Vista verkefnið fyrst');
    return;
  }
  const data = {
    dags: document.getElementById('session_dags').value,
    timi: document.getElementById('session_timi').value,
    lengd: parseInt(document.getElementById('session_lengd').value) || 60,
    lesari: document.getElementById('session_lesari').value,
    athugasemd: document.getElementById('session_athugasemd').value,
    emails: document.getElementById('session_emails').value,
  };
  try {
    await fetch('/api/verkefni/' + currentVerkefniId + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    document.getElementById('session_athugasemd').value = '';
    document.getElementById('session_emails').value = '';
    document.getElementById('session_lesari').value = '';
    document.getElementById('sessionForm').classList.remove('active');
    await saekjaLotur(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

async function eydaLotu(id) {
  if (!confirm('Eyða lotu?')) return;
  try {
    await fetch('/api/sessions/' + id, { method: 'DELETE' });
    await saekjaLotur(currentVerkefniId);
  } catch (err) {
    console.error(err);
  }
}

function downloadPDF() {
  if (!currentVerkefniId) {
    alert('Vista verkefni\u00f0 fyrst');
    return;
  }
  window.open('/api/verkefni/' + currentVerkefniId + '/pdf', '_blank');
}

async function fetchUser() {
  try {
    const res = await fetch('/auth/user', { credentials: 'include' });
    const data = await res.json();
    if (data.user) {
      document.getElementById('userName').textContent = data.user.name || data.user.email;
      document.getElementById('userInfo').style.display = 'flex';
      document.getElementById('logoutBtn').style.display = 'flex';
    }
  } catch (err) {
    console.error('Villa vi\u00f0 a\u00f0 s\u00e6kja notanda:', err);
  }
}

// Event listeners setup
function setupEventListeners() {
  // Autosave on form changes
  document.getElementById('verkefniForm').addEventListener('input', triggerAutosave);
  document.getElementById('verkefniForm').addEventListener('change', triggerAutosave);

  // Google Doc URL change
  document.getElementById('google_doc_url').addEventListener('change', async function () {
    const url = this.value;
    stopGoogleDocPolling();

    if (!url) return;

    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return;

    const docId = match[1];
    document.getElementById('handritEditor').innerHTML = 'S\u00e6ki handrit...';

    try {
      const res = await fetch('/api/google-doc/' + docId);
      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.text || '';
        document.getElementById('handritEditor').innerHTML = content;
        document.getElementById('handrit').value = content;
        triggerAutosave();
        startGoogleDocPolling(docId);
      } else {
        document.getElementById('handritEditor').innerHTML =
          'Villa vi\u00f0 a\u00f0 s\u00e6kja handrit. Athuga\u00f0u a\u00f0 Google Doc s\u00e9 opi\u00f0 fyrir "Anyone with the link".';
      }
    } catch (err) {
      console.error(err);
      document.getElementById('handritEditor').innerHTML = 'Villa vi\u00f0 a\u00f0 s\u00e6kja handrit.';
    }
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach((tab) =>
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  );

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      birtaVerkefni();
    })
  );

  // Search input
  document.getElementById('searchInput').addEventListener('input', birtaVerkefni);

  // Time type buttons
  document.querySelectorAll('.time-type-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTimeType = btn.dataset.type;
    })
  );

  // Close modal with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('active')) {
      lokaModal();
    }
  });

  // Check for ?open= parameter
  const urlParams = new URLSearchParams(window.location.search);
  const openId = urlParams.get('open');
  if (openId) {
    setTimeout(() => opnaVerkefni(parseInt(openId)), 500);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Handrit Editor functions
function formatText(command) {
  document.execCommand(command, false, null);
  document.getElementById('handritEditor').focus();
  syncHandritToHidden();
}

function formatColor(color) {
  if (color) {
    document.execCommand('foreColor', false, color);
  } else {
    document.execCommand('removeFormat', false, null);
  }
  document.getElementById('handritEditor').focus();
  syncHandritToHidden();
}

function removeAllFormatting() {
  const editor = document.getElementById('handritEditor');
  // Get plain text content
  const plainText = editor.innerText || editor.textContent;
  // Replace with plain text
  editor.innerHTML = plainText.replace(/\n/g, '<br>');
  syncHandritToHidden();
  editor.focus();
}

function syncHandritToHidden() {
  const editor = document.getElementById('handritEditor');
  document.getElementById('handrit').value = editor.innerHTML;
  triggerAutosave();
}

function syncHiddenToEditor() {
  const editor = document.getElementById('handritEditor');
  const hidden = document.getElementById('handrit').value;
  editor.innerHTML = hidden || '';
}

// Update stada from header select
function updateStada(value) {
  document.getElementById('stada').value = value;
  updateStadaColor(value);
  triggerAutosave();
}

// Update stada select color based on value
function updateStadaColor(value) {
  const select = document.getElementById('stadaHeader');
  select.classList.remove('stada-vinnslu', 'stada-bidur', 'stada-lokid');
  if (value === 'Í vinnslu') {
    select.classList.add('stada-vinnslu');
  } else if (value === 'Bíður') {
    select.classList.add('stada-bidur');
  } else if (value === 'Lokið') {
    select.classList.add('stada-lokid');
  }
}

// Send to booth and open booth modal
async function sendaOgOpnaBooth() {
  await sendaIBooth();
  opnaBoothModal();
}

// Booth Modal functions
function opnaBoothModal() {
  document.getElementById('boothModalOverlay').classList.add('active');
  // Refresh the iframe to get latest state
  const iframe = document.getElementById('boothIframe');
  iframe.src = iframe.src;
}

function opnaBoothGluggi() {
  // Send data to booth first, then open new window
  sendaIBooth();
  window.open('booth.html', 'booth', 'width=1200,height=800');
}

function lokaBoothModal() {
  document.getElementById('boothModalOverlay').classList.remove('active');
}

// Close booth modal with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('boothModalOverlay').classList.contains('active')) {
    lokaBoothModal();
  }
});

// Initialize
initDarkMode();
initView();
initConnection();
fetchUser();
saekjaVerkefni();
saekjaStofur();
saekjaFramleidslu();
saekjaLesendur();
saekjaKunnar();
setupEventListeners();

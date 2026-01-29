// search.js - Search page logic

let currentQuery = '';

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (q.length < 2) {
    document.getElementById('resultsArea').innerHTML = `
      <div class="empty-state">
        <img src="AppLogo.png" alt="Bessi">
        <div class="empty-state-title">Leitaror\u00f0 of stutt</div>
        <p>Sl\u00e1\u00f0u inn a\u00f0 minnsta kosti 2 stafi</p>
      </div>
    `;
    return;
  }

  currentQuery = q;

  const params = new URLSearchParams({ q });

  const lesari = document.getElementById('filterLesari').value.trim();
  const stofa = document.getElementById('filterStofa').value.trim();
  const stada = document.getElementById('filterStada').value;
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;

  if (lesari) params.append('lesari', lesari);
  if (stofa) params.append('stofa', stofa);
  if (stada) params.append('stada', stada);
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  document.getElementById('resultsArea').innerHTML = '<div class="loading">Leita...</div>';

  try {
    const res = await fetch('/api/search?' + params.toString());
    const results = await res.json();
    displayResults(results, q);
  } catch (err) {
    console.error(err);
    document.getElementById('resultsArea').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Villa vi\u00f0 leit</div>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function displayResults(results, query) {
  if (results.length === 0) {
    document.getElementById('resultsArea').innerHTML = `
      <div class="empty-state">
        <img src="AppLogo.png" alt="Bessi">
        <div class="empty-state-title">Ekkert fannst</div>
        <p>Engin handrit fundust me\u00f0 "${escapeHtml(query)}"</p>
      </div>
    `;
    return;
  }

  const html = `
    <div class="results-header">
      <span>${results.length} ${results.length === 1 ? 'ni\u00f0ursta\u00f0a' : 'ni\u00f0urst\u00f6\u00f0ur'} fyrir "${escapeHtml(query)}"</span>
    </div>
    ${results.map((r) => renderResult(r, query)).join('')}
  `;

  document.getElementById('resultsArea').innerHTML = html;
}

function renderResult(r, query) {
  const excerpt = getExcerpt(r.handrit || '', query);
  const stadaClass =
    r.stada === '\u00cd vinnslu' ? 'vinnslu' : r.stada === 'B\u00ed\u00f0ur' ? 'bidur' : 'lokid';
  const date = r.mottekid || r.created_at?.split('T')[0] || '';

  return `
    <div class="result-card" onclick="openProject(${r.id})">
      <div class="result-header">
        <div class="result-title">${escapeHtml(r.nafn || '\u00d3nefnt')}</div>
        <span class="status-badge ${stadaClass}">${escapeHtml(r.stada || '\u00d3\u00feekkt')}</span>
      </div>
      <div class="result-meta">
        ${r.lesari ? `<span>\ud83d\udc64 ${escapeHtml(r.lesari)}</span>` : ''}
        ${r.stofa ? `<span>\ud83c\udfe2 ${escapeHtml(r.stofa)}</span>` : ''}
        ${date ? `<span>\ud83d\udcc5 ${formatDate(date)}</span>` : ''}
      </div>
      <div class="result-excerpt">${excerpt}</div>
    </div>
  `;
}

function getExcerpt(text, query) {
  if (!text) return '<em>Ekkert handrit</em>';

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return escapeHtml(text.substring(0, 300)) + '...';

  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + query.length + 200);

  let excerpt = text.substring(start, end);

  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  excerpt = escapeHtml(excerpt).replace(regex, '<mark>$1</mark>');

  return excerpt;
}

function openProject(id) {
  window.location.href = 'index.html?open=' + id;
}

// Event listeners
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') doSearch();
});

['filterLesari', 'filterStofa', 'filterStada', 'filterFrom', 'filterTo'].forEach((id) => {
  document.getElementById(id).addEventListener('change', () => {
    if (currentQuery) doSearch();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

// Initialize
initDarkMode();

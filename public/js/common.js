// common.js - Shared utilities for all pages

// Dark mode functionality
let isDarkMode = false;

function initDarkMode(storageKey = 'dashboard-dark-mode') {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'true') {
    isDarkMode = true;
    document.documentElement.setAttribute('data-theme', 'dark');
    updateDarkModeBtn();
  }
}

function toggleDarkMode(storageKey = 'dashboard-dark-mode') {
  isDarkMode = !isDarkMode;
  if (isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(storageKey, isDarkMode);
  updateDarkModeBtn();
}

function updateDarkModeBtn() {
  const btn = document.getElementById('darkModeBtn');
  if (!btn) return;

  if (isDarkMode) {
    btn.textContent = '\u263e D\u00f6kkt';
    if (btn.classList) btn.classList.add('active');
  } else {
    btn.textContent = '\u2600 Lj\u00f3st';
    if (btn.classList) btn.classList.remove('active');
  }
}

// Date formatting
function formatDate(date) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('is-IS');
}

// HTML escaping for XSS prevention
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Regex escaping for search highlighting
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDarkMode,
    toggleDarkMode,
    updateDarkModeBtn,
    formatDate,
    escapeHtml,
    escapeRegex
  };
}

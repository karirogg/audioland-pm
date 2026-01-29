// booth/state.js - Booth state management

let currentBoothState = {
  handrit: '',
  nafn: '',
  lesari: '',
  take: 1,
  fontSize: 2,
  autoScroll: false,
  scrollSpeed: 50,
};

function getBoothState() {
  return { ...currentBoothState };
}

function updateBoothState(data) {
  currentBoothState = { ...currentBoothState, ...data };
  return currentBoothState;
}

function resetBoothState() {
  currentBoothState = {
    handrit: '',
    nafn: '',
    lesari: '',
    take: 1,
    fontSize: 2,
    autoScroll: false,
    scrollSpeed: 50,
  };
  return currentBoothState;
}

module.exports = { getBoothState, updateBoothState, resetBoothState };

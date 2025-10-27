const display = document.getElementById('display');
const overlayInfo = document.getElementById('overlay-info');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;

function showColor(color) {
  display.style.backgroundImage = 'none';
  display.style.backgroundColor = color;
  overlayInfo.textContent = `現在の色: ${color}`;
}

function showImage(imageUrl) {
  display.style.backgroundColor = '#000';
  display.style.backgroundImage = `url("${imageUrl}")`;
  display.style.backgroundSize = 'contain';
  display.style.backgroundRepeat = 'no-repeat';
  display.style.backgroundPosition = 'center';
  overlayInfo.textContent = `画像表示中:\n${imageUrl}`;
}

function handleCommand(data) {
  if (!data || typeof data !== 'object') {
    return;
  }

  const { type, value } = data;
  if (type === 'color' && typeof value === 'string') {
    showColor(value);
  } else if (type === 'image' && typeof value === 'string') {
    showImage(value);
  }
}

window.addEventListener('message', (event) => {
  handleCommand(event.data);
});

broadcastChannel?.addEventListener('message', (event) => {
  handleCommand(event.data);
});

window.addEventListener('beforeunload', () => {
  broadcastChannel?.close();
});

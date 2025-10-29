const displayFrame = document.getElementById('displayFrame');
const infoBox = document.getElementById('info');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;
let remoteWindow = null;
const templateLibrary = window.ezCalibrateTemplates;

function findTemplate(templateId) {
  if (!templateLibrary) {
    return null;
  }
  if (typeof templateLibrary.getMetadata === 'function') {
    return templateLibrary.getMetadata(templateId);
  }
  if (typeof templateLibrary.get === 'function') {
    return templateLibrary.get(templateId);
  }
  return null;
}

function updateInfo(message) {
  infoBox.textContent = message;
}

function sendMessage(data) {
  if (!displayFrame.contentWindow) {
    return;
  }
  displayFrame.contentWindow.postMessage(data, '*');
}

function applyCommand(command) {
  if (!command || typeof command !== 'object') {
    return false;
  }
  const { type, value } = command;
  if (type === 'color' && typeof value === 'string') {
    sendMessage({ type: 'color', value });
    updateInfo(`色: ${value}`);
    return true;
  } else if (type === 'image' && typeof value === 'string' && value.trim() !== '') {
    sendMessage({ type: 'image', value });
    updateInfo(`画像: ${value}`);
    return true;
  } else if (type === 'template' && typeof value === 'string') {
    sendMessage({ type: 'template', value });
    const template = findTemplate(value);
    const label = template ? template.name : `ID: ${value}`;
    updateInfo(`テンプレート: ${label}${template ? '' : ' (未登録)'}`);
    return true;
  }
  return false;
}

function processCommand(command, { fromRemote = false, shouldBroadcast = true } = {}) {
  const applied = applyCommand(command);
  if (!applied) {
    return;
  }

  if (shouldBroadcast && broadcastChannel) {
    broadcastChannel.postMessage(command);
  }

  if (remoteWindow && remoteWindow.closed) {
    remoteWindow = null;
  }

  if (!fromRemote && remoteWindow && !remoteWindow.closed) {
    remoteWindow.postMessage(
      {
        type: 'ez-calibrate-command',
        payload: command,
        broadcasted: !!broadcastChannel,
      },
      '*',
    );
  }
}

function setColor() {
  const color = document.getElementById('colorInput').value.trim() || '#ffffff';
  processCommand({ type: 'color', value: color });
}

function setImage() {
  const url = document.getElementById('imageUrl').value.trim();
  if (!url) {
    updateInfo('画像URLを入力してください。');
    return;
  }
  processCommand({ type: 'image', value: url });
}

function openRemoteWindow() {
  if (remoteWindow && !remoteWindow.closed) {
    remoteWindow.focus();
    return;
  }
  remoteWindow = window.open('remote.html', 'ezCalibrateRemote', 'width=420,height=680');
  if (!remoteWindow) {
    updateInfo('ポップアップがブロックされました。別ウィンドウ表示を許可してください。');
  }
}

function enterFullScreen() {
  const iframe = displayFrame;
  if (iframe.requestFullscreen) {
    iframe.requestFullscreen();
  } else if (iframe.webkitRequestFullscreen) {
    iframe.webkitRequestFullscreen();
  } else if (iframe.mozRequestFullScreen) {
    iframe.mozRequestFullScreen();
  } else if (iframe.msRequestFullscreen) {
    iframe.msRequestFullscreen();
  } else {
    updateInfo('このブラウザでは全画面APIがサポートされていません。');
  }
}

document.getElementById('colorButton').addEventListener('click', setColor);
document.getElementById('imageButton').addEventListener('click', setImage);
document.getElementById('fullscreenButton').addEventListener('click', enterFullScreen);
document.getElementById('popoutButton').addEventListener('click', openRemoteWindow);

document.getElementById('colorInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setColor();
  }
});

document.getElementById('imageUrl').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setImage();
  }
});

broadcastChannel?.addEventListener('message', (event) => {
  processCommand(event.data, { fromRemote: true, shouldBroadcast: false });
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'ez-calibrate-command' && data.payload && typeof data.payload === 'object') {
    const shouldBroadcast = broadcastChannel && data.broadcasted === false;
    processCommand(data.payload, { fromRemote: true, shouldBroadcast });
  }
});

window.addEventListener('beforeunload', () => {
  broadcastChannel?.close();
  if (remoteWindow && !remoteWindow.closed) {
    remoteWindow.close();
  }
});

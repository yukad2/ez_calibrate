const infoBox = document.getElementById('info');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;

function getOpenerWindow() {
  return window.opener && !window.opener.closed ? window.opener : null;
}

function updateInfo(message) {
  infoBox.textContent = message;
}

function reportCommand(command) {
  if (!command || typeof command !== 'object') {
    return;
  }
  const { type, value } = command;
  if (type === 'color' && typeof value === 'string') {
    updateInfo(`色: ${value}`);
  } else if (type === 'image' && typeof value === 'string') {
    updateInfo(`画像: ${value}`);
  }
}

function dispatchCommand(command) {
  let delivered = false;

  if (broadcastChannel) {
    broadcastChannel.postMessage(command);
    delivered = true;
  }

  const openerWindow = getOpenerWindow();
  if (openerWindow) {
    openerWindow.postMessage(
      {
        type: 'ez-calibrate-command',
        payload: command,
        broadcasted: !!broadcastChannel,
      },
      '*',
    );
    delivered = true;
  }

  if (!delivered) {
    updateInfo('制御できる表示画面が見つかりません。');
  }
}

function setColor() {
  const color = document.getElementById('colorInput').value.trim() || '#ffffff';
  reportCommand({ type: 'color', value: color });
  dispatchCommand({ type: 'color', value: color });
}

function setImage() {
  const url = document.getElementById('imageUrl').value.trim();
  if (!url) {
    updateInfo('画像URLを入力してください。');
    return;
  }
  reportCommand({ type: 'image', value: url });
  dispatchCommand({ type: 'image', value: url });
}

document.getElementById('colorButton').addEventListener('click', setColor);
document.getElementById('imageButton').addEventListener('click', setImage);

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
  reportCommand(event.data);
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'ez-calibrate-command' && data.payload && typeof data.payload === 'object') {
    reportCommand(data.payload);
  }
});

window.addEventListener('beforeunload', () => {
  broadcastChannel?.close();
});

if (!broadcastChannel) {
  if (getOpenerWindow()) {
    updateInfo('BroadcastChannel 非対応のため、このウィンドウを開いた画面のみ操作できます。');
  } else {
    updateInfo('このブラウザでは別ウィンドウ制御がサポートされていません。');
  }
}

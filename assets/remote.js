const infoBox = document.getElementById('info');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;
const tabButtons = Array.from(document.querySelectorAll('.tab-menu__tab'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

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

function activateTab(button) {
  if (!button || !(button instanceof HTMLElement)) {
    return;
  }
  const target = button.dataset.tab;
  if (!target) {
    return;
  }
  const panelId = `tab-panel-${target}`;

  tabButtons.forEach((tabButton) => {
    const isActive = tabButton === button;
    tabButton.classList.toggle('is-active', isActive);
    tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tabButton.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  tabPanels.forEach((panel) => {
    const shouldShow = panel.id === panelId;
    panel.classList.toggle('is-active', shouldShow);
    if (shouldShow) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activateTab(button);
  });

  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    if (event.key === 'Home') {
      const first = tabButtons[0];
      first.focus();
      activateTab(first);
      return;
    }
    if (event.key === 'End') {
      const last = tabButtons[tabButtons.length - 1];
      last.focus();
      activateTab(last);
      return;
    }
    const currentIndex = tabButtons.indexOf(button);
    if (currentIndex === -1) {
      return;
    }
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + offset + tabButtons.length) % tabButtons.length;
    const nextButton = tabButtons[nextIndex];
    nextButton.focus();
    activateTab(nextButton);
  });
});

if (tabButtons.length) {
  activateTab(tabButtons.find((button) => button.classList.contains('is-active')) || tabButtons[0]);
}

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

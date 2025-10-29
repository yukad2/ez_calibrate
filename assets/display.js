const display = document.getElementById('display');
const overlayInfo = document.getElementById('overlay-info');
const templateContainer = document.getElementById('template-container');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;
const templateLibrary = window.ezCalibrateTemplates;
let templateRequestToken = 0;

function cancelTemplateRequest() {
  templateRequestToken += 1;
}

function findTemplateMetadata(templateId) {
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

function clearTemplate() {
  if (templateContainer) {
    templateContainer.innerHTML = '';
    templateContainer.classList.remove('is-visible');
  }
}

function showColor(color) {
  cancelTemplateRequest();
  clearTemplate();
  display.style.backgroundImage = 'none';
  display.style.backgroundColor = color;
  overlayInfo.textContent = `現在の色: ${color}`;
}

function showImage(imageUrl) {
  cancelTemplateRequest();
  clearTemplate();
  display.style.backgroundColor = '#000';
  display.style.backgroundImage = `url("${imageUrl}")`;
  display.style.backgroundSize = 'contain';
  display.style.backgroundRepeat = 'no-repeat';
  display.style.backgroundPosition = 'center';
  overlayInfo.textContent = `画像表示中:\n${imageUrl}`;
}

function showTemplate(templateId) {
  const requestId = ++templateRequestToken;
  display.style.backgroundImage = 'none';
  display.style.backgroundColor = '#030712';

  clearTemplate();

  if (!templateLibrary) {
    overlayInfo.textContent = `テンプレート (${templateId}) を表示できません。`;
    return;
  }

  const loadTemplate =
    typeof templateLibrary.load === 'function'
      ? templateLibrary.load(templateId)
      : Promise.resolve(findTemplateMetadata(templateId));

  overlayInfo.textContent = `テンプレート (${templateId}) を読み込み中...`;

  loadTemplate
    .then((template) => {
      if (requestId !== templateRequestToken) {
        return;
      }

      if (!template || !templateContainer) {
        clearTemplate();
        overlayInfo.textContent = `テンプレート (${templateId}) を表示できません。`;
        return;
      }

      templateContainer.innerHTML = template.html || '';

      if (!templateContainer.innerHTML) {
        templateContainer.classList.remove('is-visible');
        overlayInfo.textContent = `テンプレート (${templateId}) を表示できません。`;
        return;
      }

      templateContainer.classList.add('is-visible');
      overlayInfo.textContent = `テンプレート: ${template.name}`;
    })
    .catch(() => {
      if (requestId !== templateRequestToken) {
        return;
      }
      clearTemplate();
      overlayInfo.textContent = `テンプレート (${templateId}) を表示できません。`;
    });
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
  } else if (type === 'template' && typeof value === 'string') {
    showTemplate(value);
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

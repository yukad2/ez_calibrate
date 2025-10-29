const infoBox = document.getElementById('info');
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel('ez-calibrate-control') : null;
const tabButtons = Array.from(document.querySelectorAll('.tab-menu__tab'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const colorSpaceSelect = document.getElementById('colorSpace');
const inputModeButtons = Array.from(document.querySelectorAll('.input-mode'));
const colorInputSets = Array.from(document.querySelectorAll('.color-input-set'));
const colorHexInput = document.getElementById('colorHex');
const colorFloatInputs = [
  document.getElementById('colorFloat0'),
  document.getElementById('colorFloat1'),
  document.getElementById('colorFloat2'),
];
const color255Inputs = [
  document.getElementById('color255_0'),
  document.getElementById('color255_1'),
  document.getElementById('color255_2'),
];
const colorDetailsBody = document.getElementById('colorDetailsBody');
const colorDetailsFilter = document.getElementById('colorDetailsFilter');
const colorDetailsControls = document.getElementById('colorDetailsControls');
const colorInputs = Array.from(document.querySelectorAll('.color-input-set input'));
const templateLibrary = window.ezCalibrateTemplates;
const templateListElement = document.getElementById('templateList');
const templatePreview = document.getElementById('templatePreview');
const templateButton = document.getElementById('templateButton');
const templateEmptyMessage = document.getElementById('templateEmptyMessage');
const remoteId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `remote-${Date.now()}-${Math.random()}`;

let currentInputMode = 'hex';
let lastXYZ = null;
let selectedDetailSpace = 'all';
let selectedTemplateId = null;

function getOpenerWindow() {
  return window.opener && !window.opener.closed ? window.opener : null;
}

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function multiplyMatrix(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function srgbToLinear(value) {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * value ** (1 / 2.4) - 0.055;
}

function rec2020ToLinear(value) {
  if (value < 0.08145) {
    return value / 4.5;
  }
  return ((value + 0.099) / 1.099) ** (1 / 0.45);
}

function linearToRec2020(value) {
  if (value < 0.0181) {
    return value * 4.5;
  }
  return 1.099 * value ** 0.45 - 0.099;
}

function adobeRgbToLinear(value) {
  return value ** 2.2;
}

function linearToAdobeRgb(value) {
  return value ** (1 / 2.2);
}

const MATRICES = {
  SRGB_TO_XYZ: [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.072175],
    [0.0193339, 0.119192, 0.9503041],
  ],
  XYZ_TO_SRGB: [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.969266, 1.8760108, 0.041556],
    [0.0556434, -0.2040259, 1.0572252],
  ],
  DISPLAY_P3_TO_XYZ: [
    [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
    [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
    [0, 0.04511338185890391, 1.043944368900976],
  ],
  XYZ_TO_DISPLAY_P3: [
    [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
    [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
    [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
  ],
  REC2020_TO_XYZ: [
    [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
    [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
    [0, 0.028072693049087428, 1.060985057710791],
  ],
  XYZ_TO_REC2020: [
    [1.7166511879712674, -0.35567078377639233, -0.25336628137365974],
    [-0.6666843518324892, 1.6164812366349395, 0.01576854581391113],
    [0.017639857445310783, -0.042770613257808524, 0.9421031212354738],
  ],
  ADOBE_RGB_TO_XYZ: [
    [0.576700, 0.185556, 0.188212],
    [0.297361, 0.627355, 0.075284],
    [0.027032, 0.070687, 0.991248],
  ],
  XYZ_TO_ADOBE_RGB: [
    [2.0413690, -0.5649464, -0.3446944],
    [-0.9692660, 1.8760108, 0.0415560],
    [0.0134474, -0.1183897, 1.0154096],
  ],
};

const D65 = {
  X: 0.95047,
  Y: 1,
  Z: 1.08883,
};

const KAPPA = 903.2962962962963;
const EPSILON = 0.008856451679035631;

function xyzToLuv([x, y, z]) {
  const denominator = x + 15 * y + 3 * z;
  if (denominator === 0) {
    return [0, 0, 0];
  }

  const uPrime = (4 * x) / denominator;
  const vPrime = (9 * y) / denominator;
  const yr = y / D65.Y;
  const l = yr > EPSILON ? 116 * Math.cbrt(yr) - 16 : KAPPA * yr;

  if (l === 0) {
    return [0, 0, 0];
  }

  const denominatorRef = D65.X + 15 * D65.Y + 3 * D65.Z;
  const unPrime = (4 * D65.X) / denominatorRef;
  const vnPrime = (9 * D65.Y) / denominatorRef;

  const u = 13 * l * (uPrime - unPrime);
  const v = 13 * l * (vPrime - vnPrime);
  return [l, u, v];
}

function luvToXyz([l, u, v]) {
  if (l === 0) {
    return [0, 0, 0];
  }

  const denominatorRef = D65.X + 15 * D65.Y + 3 * D65.Z;
  const unPrime = (4 * D65.X) / denominatorRef;
  const vnPrime = (9 * D65.Y) / denominatorRef;

  const a = u / (13 * l) + unPrime;
  const b = v / (13 * l) + vnPrime;

  const y = l > 8 ? D65.Y * ((l + 16) / 116) ** 3 : D65.Y * (l / KAPPA);
  if (!Number.isFinite(y) || b === 0) {
    return [0, 0, 0];
  }

  const x = (9 * y * a) / (4 * b);
  const z = (y * (12 - 3 * a - 20 * b)) / (4 * b);

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return [0, y, 0];
  }

  return [x, y, z];
}

const DEFAULT_INPUT_MODES = ['hex', 'float', '255'];

const colorSpaces = {
  srgb: {
    name: 'sRGB',
    componentLabels: ['R', 'G', 'B'],
    floatRange: { min: 0, max: 1 },
    intRange: { min: 0, max: 255 },
    inputModes: DEFAULT_INPUT_MODES,
    toXYZ(values) {
      const linear = values.map((value) => srgbToLinear(value));
      return multiplyMatrix(MATRICES.SRGB_TO_XYZ, linear);
    },
    fromXYZ(xyz) {
      const linear = multiplyMatrix(MATRICES.XYZ_TO_SRGB, xyz);
      return linear.map((value) => linearToSrgb(clamp(value, 0, 1)));
    },
  },
  linear: {
    name: 'Linear sRGB',
    componentLabels: ['R', 'G', 'B'],
    floatRange: { min: 0, max: 1 },
    intRange: { min: 0, max: 255 },
    inputModes: ['float', '255'],
    supportsHex: false,
    toXYZ(values) {
      return multiplyMatrix(MATRICES.SRGB_TO_XYZ, values);
    },
    fromXYZ(xyz) {
      return multiplyMatrix(MATRICES.XYZ_TO_SRGB, xyz);
    },
  },
  displayP3: {
    name: 'Display P3',
    componentLabels: ['R', 'G', 'B'],
    floatRange: { min: 0, max: 1 },
    intRange: { min: 0, max: 255 },
    inputModes: DEFAULT_INPUT_MODES,
    toXYZ(values) {
      const linear = values.map((value) => srgbToLinear(value));
      return multiplyMatrix(MATRICES.DISPLAY_P3_TO_XYZ, linear);
    },
    fromXYZ(xyz) {
      const linear = multiplyMatrix(MATRICES.XYZ_TO_DISPLAY_P3, xyz);
      return linear.map((value) => linearToSrgb(clamp(value, 0, 1)));
    },
  },
  rec2020: {
    name: 'Rec.2020',
    componentLabels: ['R', 'G', 'B'],
    floatRange: { min: 0, max: 1 },
    intRange: { min: 0, max: 255 },
    inputModes: DEFAULT_INPUT_MODES,
    toXYZ(values) {
      const linear = values.map((value) => rec2020ToLinear(value));
      return multiplyMatrix(MATRICES.REC2020_TO_XYZ, linear);
    },
    fromXYZ(xyz) {
      const linear = multiplyMatrix(MATRICES.XYZ_TO_REC2020, xyz);
      return linear.map((value) => linearToRec2020(clamp(value, 0, 1)));
    },
  },
  adobeRGB: {
    name: 'Adobe RGB',
    componentLabels: ['R', 'G', 'B'],
    floatRange: { min: 0, max: 1 },
    intRange: { min: 0, max: 255 },
    inputModes: DEFAULT_INPUT_MODES,
    toXYZ(values) {
      const linear = values.map((value) => adobeRgbToLinear(value));
      return multiplyMatrix(MATRICES.ADOBE_RGB_TO_XYZ, linear);
    },
    fromXYZ(xyz) {
      const linear = multiplyMatrix(MATRICES.XYZ_TO_ADOBE_RGB, xyz);
      return linear.map((value) => linearToAdobeRgb(clamp(value, 0, 1)));
    },
  },
  xyz: {
    name: 'CIE XYZ',
    componentLabels: ['X', 'Y', 'Z'],
    floatRange: null,
    intRange: null,
    inputModes: ['float'],
    supportsHex: false,
    supportsInt: false,
    toXYZ(values) {
      return values;
    },
    fromXYZ(xyz) {
      return xyz;
    },
  },
  cieluv: {
    name: 'CIELUV',
    componentLabels: ['L*', 'u*', 'v*'],
    floatRange: null,
    intRange: null,
    inputModes: ['float'],
    supportsHex: false,
    supportsInt: false,
    toXYZ(values) {
      return luvToXyz(values);
    },
    fromXYZ(xyz) {
      return xyzToLuv(xyz);
    },
  },
};

function formatHex(components) {
  const hex = components
    .map((value) => {
      if (!Number.isFinite(value)) {
        return '00';
      }
      const clamped = clamp(value, 0, 1);
      return Math.round(clamped * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
  return `#${hex}`.toUpperCase();
}

function formatFloat(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const fixed = value.toFixed(4);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  if (trimmed === '' || trimmed === '-') {
    return '0';
  }
  return trimmed;
}

function formatInt(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return Math.round(value * 255);
}

function formatLabeledList(values, labels, formatter) {
  return values
    .map((value, index) => {
      const label = labels[index] || `C${index + 1}`;
      const formatted = formatter(value);
      return `${label}: ${formatted}`;
    })
    .join(' / ');
}

function formatList(values, formatter) {
  return values
    .map((value) => formatter(value))
    .join(', ');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateTemplatePreview(template, message) {
  if (!templatePreview) {
    return;
  }

  if (typeof message === 'string') {
    templatePreview.innerHTML = `<p class="template-preview__placeholder">${escapeHtml(message)}</p>`;
    return;
  }

  if (!template) {
    templatePreview.innerHTML = '<p class="template-preview__placeholder">テンプレートを選択すると概要が表示されます。</p>';
    return;
  }

  const highlights = Array.isArray(template.highlights) && template.highlights.length
    ? `<ul class="template-preview__highlights">${template.highlights
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul>`
    : '';

  templatePreview.innerHTML = `
    <article class="template-preview__card">
      <h3 class="template-preview__title">${escapeHtml(template.name)}</h3>
      <p class="template-preview__description">${escapeHtml(template.description)}</p>
      ${highlights}
    </article>
  `;
}

function renderTemplateList() {
  if (!templateListElement) {
    return;
  }

  if (!templateLibrary || typeof templateLibrary.list !== 'function') {
    templateListElement.innerHTML = '';
    if (templateEmptyMessage) {
      templateEmptyMessage.textContent = 'テンプレートを読み込めませんでした。';
      templateEmptyMessage.hidden = false;
    }
    if (templateButton) {
      templateButton.disabled = true;
    }
    updateTemplatePreview(null, 'テンプレート情報を読み込めませんでした。');
    return;
  }

  const templates = templateLibrary.list();

  if (!templates.length) {
    templateListElement.innerHTML = '';
    if (templateEmptyMessage) {
      templateEmptyMessage.textContent = '利用できるテンプレートがありません。';
      templateEmptyMessage.hidden = false;
    }
    if (templateButton) {
      templateButton.disabled = true;
    }
    updateTemplatePreview(null, 'テンプレートがまだ登録されていません。');
    return;
  }

  if (templateEmptyMessage) {
    templateEmptyMessage.textContent = '';
    templateEmptyMessage.hidden = true;
  }

  templateListElement.innerHTML = templates
    .map(
      (template) => `
        <label class="template-picker__option">
          <input type="radio" class="template-picker__radio" name="templateSelection" value="${template.id}" />
          <span class="template-picker__content">
            <span class="template-picker__title">${escapeHtml(template.name)}</span>
            <span class="template-picker__text">${escapeHtml(template.description)}</span>
          </span>
        </label>
      `,
    )
    .join('');

  const radios = templateListElement.querySelectorAll('.template-picker__radio');
  let matched = false;
  radios.forEach((radio) => {
    if (radio.value === selectedTemplateId) {
      radio.checked = true;
      matched = true;
    }
  });

  if (templateButton) {
    templateButton.disabled = !matched;
  }

  if (matched) {
    const template = findTemplate(selectedTemplateId);
    updateTemplatePreview(template);
  } else {
    selectedTemplateId = null;
    updateTemplatePreview(null);
  }
}

function handleTemplateSelection(event) {
  const target = event.target;
  if (!target || !target.classList.contains('template-picker__radio')) {
    return;
  }

  selectedTemplateId = target.value;
  const template = findTemplate(selectedTemplateId);
  if (templateButton) {
    templateButton.disabled = !template;
  }
  if (template) {
    updateTemplatePreview(template);
  } else {
    updateTemplatePreview(null, '選択したテンプレートを読み込めません。');
  }
}

function setTemplate() {
  if (!selectedTemplateId) {
    updateInfo('テンプレートを選択してください。');
    return;
  }

  const template = findTemplate(selectedTemplateId);
  if (!template) {
    updateInfo('選択したテンプレートを読み込めませんでした。');
    return;
  }

  const delivered = dispatchCommand({ type: 'template', value: template.id });
  updateInfo(`テンプレート: ${template.name}${delivered ? '' : '\n制御先なし'}`);
}

function showExternalTemplate(templateId) {
  const template = findTemplate(templateId);
  selectedTemplateId = template ? templateId : null;

  if (templateListElement) {
    const radios = templateListElement.querySelectorAll('.template-picker__radio');
    let matched = false;
    radios.forEach((radio) => {
      const isMatch = template && radio.value === templateId;
      radio.checked = isMatch;
      if (isMatch) {
        matched = true;
      }
    });

    if (template && !matched) {
      renderTemplateList();
    }
  }

  if (templateButton) {
    templateButton.disabled = !template;
  }

  if (template) {
    updateTemplatePreview(template);
    updateInfo(`テンプレート: ${template.name}`);
  } else {
    updateTemplatePreview(null, `テンプレート (${templateId}) を表示できません。`);
    updateInfo(`テンプレート: ${templateId}`);
  }
}

function initializeTemplatePanel() {
  renderTemplateList();
  if (!selectedTemplateId) {
    updateTemplatePreview(null);
  }
}

function formatInputLabel(mode) {
  if (mode === 'hex') {
    return '#HEX';
  }
  if (mode === 'float') {
    return 'Float';
  }
  return '0-255';
}

function showDetailsPlaceholder(message) {
  if (colorDetailsControls) {
    colorDetailsControls.hidden = true;
  }
  if (colorDetailsBody) {
    colorDetailsBody.innerHTML = `<p class="color-details__empty">${message}</p>`;
  }
}

function updateDetailFilterOptions(availableKeys) {
  if (!colorDetailsFilter || !colorDetailsControls) {
    return;
  }

  const uniqueKeys = Array.from(new Set(availableKeys));
  if (selectedDetailSpace !== 'all' && !uniqueKeys.includes(selectedDetailSpace)) {
    selectedDetailSpace = 'all';
  }

  const options = [
    { value: 'all', label: 'すべて' },
    ...uniqueKeys.map((key) => ({ value: key, label: colorSpaces[key]?.name || key })),
  ];

  colorDetailsFilter.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  colorDetailsFilter.value = selectedDetailSpace;
  colorDetailsControls.hidden = options.length <= 1;
}

function renderColorDetails(xyz, currentSpaceKey) {
  if (!xyz || xyz.some((value) => !Number.isFinite(value))) {
    showDetailsPlaceholder('色の詳細を表示できません。入力値を確認してください。');
    return;
  }

  const entries = Object.entries(colorSpaces).filter(([key]) => key !== currentSpaceKey);
  if (!entries.length) {
    showDetailsPlaceholder('表示可能な色空間がありません。');
    return;
  }

  updateDetailFilterOptions(entries.map(([key]) => key));

  let filteredEntries = entries;
  if (selectedDetailSpace !== 'all') {
    filteredEntries = entries.filter(([key]) => key === selectedDetailSpace);
    if (!filteredEntries.length) {
      selectedDetailSpace = 'all';
      if (colorDetailsFilter) {
        colorDetailsFilter.value = 'all';
      }
      filteredEntries = entries;
    }
  }

  const cards = filteredEntries
    .map(([key, space]) => {
      const components = space.fromXYZ(xyz);
      const labels = space.componentLabels || [];
      const supportsHex = space.supportsHex !== false;
      const supportsInt = space.supportsInt !== false;
      const floatValue = formatList(components, formatFloat);
      const floatTitle = formatLabeledList(components, labels, formatFloat);
      const hexValue = supportsHex ? formatHex(components) : '—';
      const intValue = supportsInt ? formatList(components, formatInt) : '—';
      const intTitle = supportsInt
        ? formatLabeledList(components, labels, (value) => formatInt(value))
        : '';

      return `
        <article class="color-details__card">
          <h3 class="color-details__card-title">${space.name}</h3>
          <dl class="color-details__list">
            <div class="color-details__list-row">
              <dt class="color-details__term">#HEX</dt>
              <dd class="color-details__value">${hexValue}</dd>
            </div>
            <div class="color-details__list-row">
              <dt class="color-details__term">Float</dt>
              <dd class="color-details__value" title="${escapeHtml(floatTitle)}">${floatValue}</dd>
            </div>
            <div class="color-details__list-row">
              <dt class="color-details__term">0-255</dt>
              <dd class="color-details__value"${supportsInt ? ` title="${escapeHtml(intTitle)}"` : ''}>${intValue}</dd>
            </div>
          </dl>
        </article>
      `;
    })
    .join('');

  if (!cards.trim()) {
    showDetailsPlaceholder('表示可能な色空間がありません。');
    return;
  }

  if (colorDetailsControls) {
    colorDetailsControls.hidden = false;
  }

  colorDetailsBody.innerHTML = `
    <h2 class="color-details__title">他の色空間での値</h2>
    <div class="color-details__cards">${cards}</div>
  `;
}

function updateComponentLabels(spaceKey) {
  const space = colorSpaces[spaceKey];
  const labels = space ? space.componentLabels : ['R', 'G', 'B'];
  document.querySelectorAll('.color-input-set__label').forEach((element) => {
    const index = Number(element.dataset.componentIndex || 0);
    element.textContent = labels[index] || labels[labels.length - 1] || '';
  });
}

function populateInputsFromXYZ(xyz, spaceKey) {
  const space = colorSpaces[spaceKey];
  if (!space || !xyz || xyz.some((value) => !Number.isFinite(value))) {
    return;
  }
  const components = space.fromXYZ(xyz);
  colorHexInput.value = formatHex(components);
  colorFloatInputs.forEach((input, index) => {
    input.value = formatFloat(components[index] ?? 0);
  });
  color255Inputs.forEach((input, index) => {
    input.value = formatInt(components[index] ?? 0);
  });
}

function parseHexInput() {
  const raw = colorHexInput.value.trim();
  if (!raw) {
    throw new Error('#HEX 値を入力してください。');
  }
  const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    throw new Error('#HEX 値の形式が正しくありません。');
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const components = [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
  const normalized = `#${hex}`.toUpperCase();
  colorHexInput.value = normalized;
  return { components, formattedInput: normalized };
}

function parseNumericInputs(spaceKey, mode) {
  const inputs = mode === 'float' ? colorFloatInputs : color255Inputs;
  const rawValues = inputs.map((input) => input.value.trim());
  if (rawValues.some((value) => value === '')) {
    throw new Error('全ての成分に値を入力してください。');
  }
  const numericValues = rawValues.map((value) => Number(value));
  if (numericValues.some((value) => !Number.isFinite(value))) {
    throw new Error('数値を入力してください。');
  }

  const space = colorSpaces[spaceKey];
  if (!space) {
    throw new Error('未対応の色空間です。');
  }

  if (mode === 'float' && space.floatRange) {
    const { min, max } = space.floatRange;
    numericValues.forEach((value, index) => {
      if (value < min || value > max) {
        throw new Error(`${space.componentLabels[index]} は ${min} 〜 ${max} の範囲で入力してください。`);
      }
    });
    return {
      components: numericValues,
      formattedInput: numericValues.map((value) => formatFloat(value)).join(', '),
    };
  }

  if (mode === '255') {
    if (space.intRange) {
      const { min, max } = space.intRange;
      numericValues.forEach((value, index) => {
        if (value < min || value > max) {
          throw new Error(`${space.componentLabels[index]} は ${min} 〜 ${max} の範囲で入力してください。`);
        }
      });
    }
    return {
      components: numericValues.map((value) => value / 255),
      formattedInput: numericValues.map((value) => Math.round(value)).join(', '),
    };
  }

  return {
    components: numericValues,
    formattedInput: numericValues.map((value) => formatFloat(value)).join(', '),
  };
}

function parseColorInputs(spaceKey, mode) {
  const space = colorSpaces[spaceKey];
  const allowedModes = space?.inputModes || DEFAULT_INPUT_MODES;
  if (!allowedModes.includes(mode)) {
    throw new Error('この色空間では選択した入力方式を利用できません。');
  }
  if (mode === 'hex') {
    return parseHexInput();
  }
  return parseNumericInputs(spaceKey, mode);
}

function parseHexColorToComponents(value) {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function setInputMode(mode) {
  const space = colorSpaces[colorSpaceSelect.value];
  const allowedModes = space?.inputModes || DEFAULT_INPUT_MODES;
  if (!allowedModes.includes(mode)) {
    return;
  }
  currentInputMode = mode;
  inputModeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  colorInputSets.forEach((set) => {
    const isActive = set.dataset.mode === mode && !set.classList.contains('is-disabled');
    set.classList.toggle('is-active', isActive);
  });
  if (lastXYZ) {
    populateInputsFromXYZ(lastXYZ, colorSpaceSelect.value);
  }
}

function updateInputModeOptions(spaceKey) {
  const space = colorSpaces[spaceKey];
  const allowedModes = space?.inputModes || DEFAULT_INPUT_MODES;

  if (!allowedModes.includes(currentInputMode)) {
    currentInputMode = allowedModes[0] || 'float';
  }

  inputModeButtons.forEach((button) => {
    const { mode } = button.dataset;
    if (!mode) {
      return;
    }
    const allowed = allowedModes.includes(mode);
    button.disabled = !allowed;
    button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    button.classList.toggle('is-disabled', !allowed);
  });

  colorInputSets.forEach((set) => {
    const mode = set.dataset.mode;
    const allowed = allowedModes.includes(mode);
    set.classList.toggle('is-disabled', !allowed);
  });

  setInputMode(currentInputMode);
}

function setColor() {
  const spaceKey = colorSpaceSelect.value;
  const mode = currentInputMode;
  let parsed;
  try {
    parsed = parseColorInputs(spaceKey, mode);
  } catch (error) {
    updateInfo(error.message);
    return;
  }

  const space = colorSpaces[spaceKey];
  if (!space) {
    updateInfo('未対応の色空間です。');
    return;
  }

  const xyz = space.toXYZ(parsed.components);
  if (xyz.some((value) => !Number.isFinite(value))) {
    updateInfo('色の変換に失敗しました。値を確認してください。');
    return;
  }

  lastXYZ = xyz;
  const srgbComponents = colorSpaces.srgb.fromXYZ(xyz).map((value) => clamp(value, 0, 1));
  const cssColor = formatHex(srgbComponents);
  const delivered = dispatchCommand({ type: 'color', value: cssColor });

  populateInputsFromXYZ(lastXYZ, spaceKey);
  renderColorDetails(lastXYZ, spaceKey);

  const summary = [
    `色空間: ${space.name}`,
    `入力 (${formatInputLabel(mode)}): ${parsed.formattedInput}`,
    `CSS (sRGB): ${cssColor}${delivered ? '' : ' / 制御先なし'}`,
  ];
  updateInfo(summary.join('\n'));
}

function showExternalColor(command) {
  const { value } = command;
  if (typeof value !== 'string') {
    return;
  }
  updateInfo(`色: ${value}`);
  const components = parseHexColorToComponents(value);
  if (!components) {
    showDetailsPlaceholder('受信した色の詳細は #HEX 形式のときに表示されます。');
    return;
  }
  lastXYZ = colorSpaces.srgb.toXYZ(components);
  populateInputsFromXYZ(lastXYZ, colorSpaceSelect.value);
  renderColorDetails(lastXYZ, colorSpaceSelect.value);
}

function setImage() {
  const url = document.getElementById('imageUrl').value.trim();
  if (!url) {
    updateInfo('画像URLを入力してください。');
    return;
  }
  const delivered = dispatchCommand({ type: 'image', value: url });
  updateInfo(`画像: ${url}${delivered ? '' : '\n制御先なし'}`);
}

function reportCommand(command) {
  if (!command || typeof command !== 'object' || command.originId === remoteId) {
    return;
  }
  const { type, value } = command;
  if (type === 'color') {
    showExternalColor(command);
  } else if (type === 'image' && typeof value === 'string') {
    updateInfo(`画像: ${value}`);
  } else if (type === 'template' && typeof value === 'string') {
    showExternalTemplate(value);
  }
}

function dispatchCommand(command) {
  let delivered = false;
  const payload = { ...command, originId: remoteId };

  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
    delivered = true;
  }

  const openerWindow = getOpenerWindow();
  if (openerWindow) {
    openerWindow.postMessage(
      {
        type: 'ez-calibrate-command',
        payload,
        broadcasted: !!broadcastChannel,
      },
      '*',
    );
    delivered = true;
  }

  return delivered;
}

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

function initializeColorForm() {
  const spaceKey = colorSpaceSelect.value;
  updateComponentLabels(spaceKey);
  updateInputModeOptions(spaceKey);
  const defaultXYZ = colorSpaces.srgb.toXYZ([1, 0, 0]);
  lastXYZ = defaultXYZ;
  populateInputsFromXYZ(defaultXYZ, spaceKey);
  renderColorDetails(defaultXYZ, spaceKey);
}

inputModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const { mode } = button.dataset;
    if (mode && !button.disabled) {
      setInputMode(mode);
    }
  });
});

colorSpaceSelect.addEventListener('change', () => {
  const spaceKey = colorSpaceSelect.value;
  updateComponentLabels(spaceKey);
  updateInputModeOptions(spaceKey);
  if (lastXYZ) {
    populateInputsFromXYZ(lastXYZ, spaceKey);
    renderColorDetails(lastXYZ, spaceKey);
  }
});

colorDetailsFilter?.addEventListener('change', (event) => {
  selectedDetailSpace = event.target.value;
  if (lastXYZ) {
    renderColorDetails(lastXYZ, colorSpaceSelect.value);
  }
});

colorInputs.forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setColor();
    }
  });
});

document.getElementById('colorButton').addEventListener('click', setColor);
document.getElementById('imageButton').addEventListener('click', setImage);

document.getElementById('imageUrl').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setImage();
  }
});

templateListElement?.addEventListener('change', handleTemplateSelection);
templateButton?.addEventListener('click', setTemplate);

initializeTemplatePanel();
initializeColorForm();

function setupTabs() {
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
}

setupTabs();

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

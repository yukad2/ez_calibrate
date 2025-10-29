(function () {
  const templateDefinitions = [
    {
      id: 'session-intro',
      name: 'セッション紹介',
      description: '開演前の案内やタイトル表示に使えるシンプルな導入テンプレートです。',
      highlights: ['タイトルとサブタイトルを中央に配置', '背景に淡いグラデーションを適用', '短い補足テキストを表示'],
      htmlPath: 'assets/templates/session-intro.html',
    },
    {
      id: 'today-schedule',
      name: '進行スケジュール',
      description: '時間ごとの進行をリストで提示するテンプレートです。',
      highlights: ['3つのタイムスロットをリスト表示', '注意書きを下部に表示', '背景を落ち着いたブルーで統一'],
      htmlPath: 'assets/templates/today-schedule.html',
    },
    {
      id: 'thanks-message',
      name: '終了メッセージ',
      description: '配信終了時に感謝と次のアクションを案内するテンプレートです。',
      highlights: ['メインタイトルとサブタイトルで締めの挨拶', 'アンケートURLなどの案内枠を表示', '淡いオーロラ調の背景を適用'],
      htmlPath: 'assets/templates/thanks-message.html',
    },
  ];

  const definitionMap = new Map(templateDefinitions.map((definition) => [definition.id, definition]));

  function cloneHighlights(highlights) {
    return Array.isArray(highlights) ? [...highlights] : highlights;
  }

  function cloneMetadata(definition) {
    if (!definition) {
      return null;
    }
    const { htmlPath, highlights, ...rest } = definition;
    return {
      ...rest,
      highlights: cloneHighlights(highlights),
    };
  }

  async function fetchTemplate(definition) {
    const response = await fetch(definition.htmlPath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.status}`);
    }
    const html = await response.text();
    const metadata = cloneMetadata(definition);
    return { ...metadata, html };
  }

  const loadCache = new Map();

  window.ezCalibrateTemplates = {
    list() {
      return templateDefinitions.map((definition) => cloneMetadata(definition));
    },
    getMetadata(templateId) {
      const definition = definitionMap.get(templateId);
      return cloneMetadata(definition);
    },
    get(templateId) {
      return this.getMetadata(templateId);
    },
    async load(templateId) {
      const definition = definitionMap.get(templateId);
      if (!definition) {
        return null;
      }

      if (!loadCache.has(templateId)) {
        loadCache.set(
          templateId,
          fetchTemplate(definition)
            .then((template) => {
              loadCache.set(templateId, Promise.resolve(template));
              return template;
            })
            .catch((error) => {
              loadCache.delete(templateId);
              throw error;
            }),
        );
      }

      try {
        const template = await loadCache.get(templateId);
        return {
          ...template,
          highlights: cloneHighlights(template.highlights),
        };
      } catch (error) {
        return null;
      }
    },
  };
})();

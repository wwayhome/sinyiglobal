(() => {
  const byId = id => document.getElementById(id);
  const fields = ['titleIn', 'subIn', 'amount', 'agent', 'phone', 'approval'];
  const editors = ['editor', 'features'];
  const fileInput = byId('draftFile');
  const status = byId('draftStatus');
  function editorMarkup(field) {
    const content = document.createElement('div');
    content.innerHTML = field.innerHTML;
    for (const item of content.querySelectorAll('[data-item-align]')) {
      item.removeAttribute('data-item-align');
    }
    // Some browsers put the first paragraph's alignment on the editing host.
    // Store that inherited alignment inside the existing draft HTML format.
    if (field.style.textAlign) {
      content.style.textAlign = field.style.textAlign;
      return content.outerHTML;
    }
    return content.innerHTML;
  }
  const snapshot = () => ({
    type: 'sinyi-fax-draft',
    version: 4,
    showOptOut: byId('showOptOut').checked,
    fields: {
      ...Object.fromEntries(fields.map(id => [id, byId(id).value])),
      product: selectedChoice('product'),
      transaction: selectedChoice('transaction')
    },
    hideIcon: byId('hideIcon').checked,
    hidePrice: byId('hidePrice').checked,
    editors: Object.fromEntries(editors.map(id => [id, editorMarkup(byId(id))]))
  });
  let lastSaved = JSON.stringify(snapshot());

  byId('saveDraft').onclick = () => {
    const draft = snapshot();
    const file = new Blob([JSON.stringify(draft, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = (draft.fields.titleIn || '物件').replace(/[\\/:*?"<>|]/g, '_') + '_傳真編輯檔.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    lastSaved = JSON.stringify(draft);
    status.textContent = '已開始下載編輯檔。';
  };

  // Rebuild editor content from the formatting supported by the tool.
  function editableContent(html) {
    const source = document.createElement('template');
    source.innerHTML = html;
    const allowed = new Set(['div', 'p', 'br', 'ul', 'ol', 'li', 'span', 'b', 'strong', 'i', 'em', 'u', 'font']);
    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.data);
      if (node.nodeType !== Node.ELEMENT_NODE || !allowed.has(node.localName)) {
        return document.createDocumentFragment();
      }
      const element = document.createElement(node.localName);
      if (element.localName === 'font' && /^[2-4]$/.test(node.getAttribute('size'))) element.size = node.size;
      const align = node.style.textAlign || node.getAttribute('align');
      if (['left', 'center', 'right', 'start', 'end'].includes(align)) element.style.textAlign = align;
      if (['bold', 'normal', '700', '400'].includes(node.style.fontWeight)) element.style.fontWeight = node.style.fontWeight;
      if (Object.hasOwn(fontLevels, node.style.fontSize)) element.style.fontSize = node.style.fontSize;
      for (const child of node.childNodes) element.append(clean(child));
      return element;
    }
    const result = document.createDocumentFragment();
    for (const node of source.content.childNodes) result.append(clean(node));
    return result;
  }

  function parseDraft(text) {
    const draft = JSON.parse(text);
    if (draft?.type !== 'sinyi-fax-draft' || ![1, 2, 3, 4].includes(draft.version) ||
        typeof draft.hideIcon !== 'boolean' ||
        (draft.version === 4 && typeof draft.showOptOut !== 'boolean') ||
        (draft.version >= 3 && typeof draft.hidePrice !== 'boolean') ||
        !fields.every(id => typeof draft.fields?.[id] === 'string') ||
        !editors.every(id => typeof draft.editors?.[id] === 'string')) throw Error();
    if (draft.version < 4) draft.showOptOut = true;
    if (draft.version < 3) draft.hidePrice = false;
    const values = draft.fields;
    if (draft.version === 1) values.transaction = 'sale';
    if (['product', 'transaction'].some(name => !Array.from(document.getElementsByName(name)).some(option => option.value === values[name])) ||
        fields.some(id => byId(id).maxLength >= 0 && values[id].length > byId(id).maxLength) ||
        !/^\d{0,10}$/.test(values.approval)) throw Error();
    return {draft, contents: editors.map(id => editableContent(draft.editors[id]))};
  }

  byId('loadDraft').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const {draft, contents} = parseDraft(await file.text());
      if (JSON.stringify(snapshot()) !== lastSaved &&
          !window.confirm('目前有尚未儲存的修改。要以讀取的編輯檔取代目前內容嗎？')) return;
      for (const id of fields) byId(id).value = draft.fields[id];
      for (const name of ['product', 'transaction']) {
        for (const radio of document.getElementsByName(name)) radio.checked = radio.value === draft.fields[name];
      }
      byId('showOptOut').checked = draft.showOptOut;
      byId('hideIcon').checked = draft.hideIcon;
      byId('hidePrice').checked = draft.hidePrice;
      editors.forEach((id, index) => {
        const field = byId(id);
        field.style.removeProperty('text-align');
        field.replaceChildren(contents[index]);
      });
      byId('approval').setCustomValidity('');
      render();
      lastSaved = JSON.stringify(snapshot());
      status.textContent = '已讀取「' + file.name + '」，可繼續編輯。';
    } catch {
      status.textContent = '無法讀取，請選擇本工具儲存的 JSON 編輯檔。';
    } finally {
      fileInput.value = '';
    }
  };
})();

const $=id=>document.getElementById(id), ed=$('editor'), copy=$('copy'), details=document.querySelector('.details');
function stamp(){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('date').textContent='製作日期：'+parts.replaceAll('-','/')}
function fitLine(node,max,width){
  let size=max;
  node.style.fontSize=size+'cqw';
  while(size>1 && node.scrollWidth>width+1){size-=.15;node.style.fontSize=size+'cqw'}
}
function fit(){
  const headline=$('headline'),titleRow=headline.closest('.titleRow');
  let titleSize=13;
  titleRow.style.fontSize=titleSize+'cqw';
  while(titleSize>1 && headline.scrollWidth>headline.clientWidth){
    titleSize-=.1;
    titleRow.style.fontSize=titleSize+'cqw'
  }
  const subtitle=$('subtitle');
  let subSize=4.7;
  subtitle.style.fontSize=subSize+'cqw';
  while(subSize>1 && subtitle.scrollWidth>subtitle.clientWidth){
    subSize-=.05;
    subtitle.style.fontSize=subSize+'cqw'
  }
  const priceRow=$('transactionBadge').parentElement;
  let amountSize=10.5;
  $('price').style.fontSize=amountSize+'cqw';
  while(amountSize>1 && priceRow.scrollWidth>priceRow.clientWidth){
    amountSize-=.1;
    $('price').style.fontSize=amountSize+'cqw'
  }
  const line=$('person').parentElement;
  fitLine(line,5,line.clientWidth);
  // Keep the entire opt-out paragraph visible in the two lines below the phone.
  const notice = $('optOut');
  if (!notice.hidden && notice.clientWidth) {
    notice.style.removeProperty('font-size');
    let noticeSize = parseFloat(getComputedStyle(notice).fontSize);
    while (noticeSize > 1 && notice.getBoundingClientRect().height >
           2 * parseFloat(getComputedStyle(notice).lineHeight) + 1) {
      noticeSize *= 0.98;
      notice.style.fontSize = noticeSize + 'px';
    }
  }
  // Convert 22 print points to a percentage of the 210 mm A4 width.
  let size=22*25.4/72/210*100;
  const overflow=()=>Array.from(details.children).some(col=>col.scrollHeight>col.clientHeight+1);
  details.style.setProperty('--body-size',size+'cqw');details.style.fontSize='var(--body-size)';
  while(size>2.3 && overflow()){size-=.1;details.style.setProperty('--body-size',size+'cqw');details.style.fontSize='var(--body-size)'}
  const full=priceRow.scrollWidth>priceRow.clientWidth+1||overflow()||details.clientHeight<1||document.querySelector('.paper').scrollHeight>document.querySelector('.paper').clientHeight+1;
  $('warning').textContent=full?'內容已超出一頁，請檢查金額長度或調整兩欄內容。':'';
  return !full
}
function selectedChoice(name){
  return document.querySelector('input[name="'+name+'"]:checked').value
}
function renderHeading(){
  $('headline').textContent=$('titleIn').value;
  $('subtitle').textContent=$('subIn').value;
  $('tc').textContent=$('titleIn').value.length+' / 10';
  $('sc').textContent=$('subIn').value.length+' / 22';
  $('iconColumn').toggleAttribute('hidden',$('hideIcon').checked);
  $('selectedIcon').setAttribute('href','#icon-'+selectedChoice('product'));
}
const fontLevels = {small: 2, medium: 3, large: 4, '13px': 2, '16px': 3, '18px': 4};
function elementFontLevel(element) {
  return fontLevels[element.style.fontSize] || Number(element.getAttribute('size')) || 0;
}

// Native editing may store alignment on the list item, on its first
// paragraph, or on an ancestor. Place the marker with that paragraph.
function positionListItems(field) {
  for (const item of field.querySelectorAll('li')) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    const paragraph = walker.nextNode()?.parentElement || item;
    const align = getComputedStyle(paragraph).textAlign;
    if (align === 'center' || align === 'right' || align === 'end') {
      item.dataset.itemAlign = align;
    } else {
      delete item.dataset.itemAlign;
    }
  }
}

function render(){
$('optOut').hidden = !$('showOptOut').checked;
renderHeading();
const renting=selectedChoice('transaction')==='rent';
const hidePrice=$('hidePrice').checked;
$('amountGroup').hidden=hidePrice;
$('priceInquiry').hidden=!hidePrice;
$('amount').disabled=hidePrice;
$('transactionBadge').textContent=renting?'出租':'出售';
$('amountLabel').textContent=renting?'每月租金':'出售價格';
$('inputUnit').textContent=$('printUnit').textContent=renting?'萬元／月':'萬元';
const approval = $('approval');
approval.value = approval.value.replace(/\D/g, '');
const serial = $('serial');
serial.hidden = !approval.value;
serial.textContent = approval.value ? '核准編號：' + approval.value : '';
const amount=$('amount');
const normalized=amount.value.normalize('NFKC').replace(/[^0-9.]/g,'');
const [integer,...decimals]=normalized.split('.');
const fraction=decimals.length?'.'+decimals.join(''):'';
const cleaned=integer+fraction;
if(amount.value!==cleaned)amount.value=cleaned;
$('price').textContent=cleaned?(integer||'0').replace(/\B(?=(\d{3})+(?!\d))/g,',')+fraction:'＿＿＿';
$('person').textContent=$('agent').value||'＿＿＿';
$('phoneOut').textContent=$('phone').value||'＿＿＿＿＿＿';
for(const [source,target] of [[ed,copy],[$('features'),$('featureCopy')]]){
  positionListItems(source);
  target.style.textAlign = source.style.textAlign;
  target.replaceChildren(...Array.from(source.childNodes,node=>node.cloneNode(true)));
  const points={2:18,3:22,4:26};
  for(const node of target.querySelectorAll('font[size],[style]')){
    const pt=points[elementFontLevel(node)];
    if(pt)node.style.fontSize='calc(var(--body-size) * '+pt/22+')'
  }
}
stamp();fit()}
document.addEventListener('input',event=>{if(!event.isComposing)render()});
document.addEventListener('compositionend',render);
for(const block of document.querySelectorAll('.editing')){
  const field=block.querySelector('.editor'),bar=block.querySelector('.bar');
  field.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
  field.addEventListener('drop',e=>e.preventDefault());

  // A live caret for each selected run also identifies empty paragraphs.
  function selectedRuns(range) {
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const runs = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType !== Node.TEXT_NODE && node.nodeName !== 'BR') continue;
      if (!range.intersectsNode(node)) continue;
      if (node === range.endContainer && range.endOffset === 0) continue;
      if (node === range.startContainer && range.startOffset === node.length) continue;
      const caret = document.createRange();
      if (node.nodeName === 'BR') caret.setStartBefore(node);
      else caret.setStart(node, node === range.startContainer ? range.startOffset : 0);
      caret.collapse(true);
      runs.push({node, caret});
    }
    return runs;
  }

  function currentLevel(node) {
    for (let element = node.parentElement; element && element !== field; element = element.parentElement) {
      const level = elementFontLevel(element);
      if (level) return level;
    }
    return 3;
  }

  function toggleList(selection, range, runs) {
    const inList = node => Boolean(node.parentElement.closest('ul'));
    if (!runs.some(run => inList(run.node)) || runs.every(run => inList(run.node))) {
      document.execCommand('insertUnorderedList');
      return;
    }
    // A native toggle on a mixed range inverts each paragraph separately.
    // Add bullets only to the plain paragraphs, starting at the bottom so
    // subsequent paragraph joins do not invalidate the earlier live carets.
    for (const {caret} of runs.reverse()) {
      selection.removeAllRanges();
      selection.addRange(caret);
      if (!document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList');
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function apply(button) {
    const selection = window.getSelection();
    const localSelection = selection.rangeCount &&
      field.contains(selection.anchorNode) && field.contains(selection.focusNode);
    const whole = !localSelection || selection.isCollapsed;
    const range = whole ? document.createRange() : selection.getRangeAt(0).cloneRange();
    if (whole) range.selectNodeContents(field);

    field.focus({preventScroll: true});
    selection.removeAllRanges();
    selection.addRange(range);
    if (button.dataset.step) {
      const levels = new Set(selectedRuns(range).map(run => currentLevel(run.node)));
      const level = levels.size === 1 ? levels.values().next().value : 3;
      const next = Math.max(2, Math.min(4, level + Number(button.dataset.step)));
      document.execCommand('fontSize', false, String(next));
    } else if (button.dataset.c === 'insertUnorderedList') {
      toggleList(selection, range, selectedRuns(range));
    } else {
      document.execCommand(button.dataset.c, false, null);
    }
    if (whole && selection.rangeCount) selection.collapseToEnd();
    render();
  }

  // Retain the live text selection when the pointer moves onto the toolbar.
  bar.addEventListener('mousedown', event => {
    if (event.target.closest('button')) event.preventDefault();
  });
  bar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) apply(button);
  });
}
$('printBtn').onclick=async()=>{if($('approval').value&&$('approval').value.length!==10){$('approval').setCustomValidity('核准編號請填滿 10 碼數字');$('approval').reportValidity();return}if(!fit()){$('warning').scrollIntoView();return}await document.fonts.ready;if(!fit()){$('warning').scrollIntoView();return}stamp();window.print()};$('approval').oninput=()=> $('approval').setCustomValidity('');window.addEventListener('beforeprint',()=>{stamp();fit()});new ResizeObserver(fit).observe(details);document.fonts.addEventListener('loadingdone',fit);render();

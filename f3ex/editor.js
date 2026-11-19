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
function alignFacts(){
  // Split each formatted paragraph at its first colon, preserving inline markup.
  for(const item of [copy,...copy.querySelectorAll('li,div,p')]){
    if(item.querySelector('li,div,p,ul,ol'))continue;
    const walker=document.createTreeWalker(item,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const colon=node.data.search(/[:：]/);
      if(colon<0)continue;
      const prefix=document.createRange();
      prefix.selectNodeContents(item);
      prefix.setEnd(node,colon+1);
      const label=document.createElement('span');
      label.append(prefix.extractContents());
      const value=document.createElement('span');
      value.append(...Array.from(item.childNodes));
      const line=document.createElement('span');
      line.className='factLine';
      line.append(label,value);
      item.append(line);
      break
    }
  }
}
function render(){
renderHeading();
const renting=selectedChoice('transaction')==='rent';
const hidePrice=$('hidePrice').checked;
$('amountGroup').hidden=hidePrice;
$('priceInquiry').hidden=!hidePrice;
$('amount').disabled=hidePrice;
$('transactionBadge').textContent=renting?'出租':'出售';
$('amountLabel').textContent=renting?'每月租金':'出售價格';
$('inputUnit').textContent=$('printUnit').textContent=renting?'萬元／月':'萬元';
$('approval').value=$('approval').value.replace(/\D/g,'');$('serial').textContent='核准編號：'+($('approval').value||'＿＿＿＿＿＿');const amount=$('amount');
const normalized=amount.value.normalize('NFKC').replace(/[^0-9.]/g,'');
const [integer,...decimals]=normalized.split('.');
const fraction=decimals.length?'.'+decimals.join(''):'';
const cleaned=integer+fraction;
if(amount.value!==cleaned)amount.value=cleaned;
$('price').textContent=cleaned?(integer||'0').replace(/\B(?=(\d{3})+(?!\d))/g,',')+fraction:'＿＿＿';
$('person').textContent=$('agent').value||'＿＿＿';
$('phoneOut').textContent=$('phone').value||'＿＿＿＿＿＿';
for(const [source,target] of [[ed,copy],[$('features'),$('featureCopy')]]){
  target.replaceChildren(...Array.from(source.childNodes,node=>node.cloneNode(true)));
  const points={2:18,3:22,4:26};
  const keywords={small:18,medium:22,large:26};
  for(const node of target.querySelectorAll('font[size],span[style]')){
    const pt=keywords[node.style.fontSize]||points[node.getAttribute('size')];
    if(pt)node.style.fontSize='calc(var(--body-size) * '+pt/22+')'
  }
}
alignFacts();stamp();fit()}
document.addEventListener('input',event=>{if(!event.isComposing)render()});
document.addEventListener('compositionend',render);
for(const block of document.querySelectorAll('.editing')){
  const field=block.querySelector('.editor'),bar=block.querySelector('.bar');
  let range;
  function remember(){const sel=getSelection();if(sel.rangeCount && field.contains(sel.anchorNode)&&field.contains(sel.focusNode))range=sel.getRangeAt(0).cloneRange()}
  document.addEventListener('selectionchange',remember);
  field.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
  field.addEventListener('drop',e=>e.preventDefault());
  function apply(cmd,step){
    const sel=getSelection();
    const local=sel.rangeCount && field.contains(sel.anchorNode) && field.contains(sel.focusNode);
    const active=local?sel.getRangeAt(0).cloneRange():null;
    const whole=Boolean(step && (!active || active.collapsed));
    const target=whole?document.createRange():(active || (!step && range));
    if(whole)target.selectNodeContents(field);
    field.focus();
    if(target && field.contains(target.commonAncestorContainer)){
      sel.removeAllRanges();
      sel.addRange(target)
    }
    if(step){
      const current=Number(document.queryCommandValue('fontSize'))||3;
      const next=Math.max(2,Math.min(4,current+step));
      document.execCommand('fontSize',false,String(next));
      if(whole && sel.rangeCount)sel.collapseToEnd()
    }else{
      document.execCommand(cmd,false,null)
    }
    remember();render()
  }
  bar.onmousedown=e=>{remember();if(e.target.closest('button'))e.preventDefault()};
  bar.onclick=e=>{const button=e.target.closest('button');if(button)apply(button.dataset.c,Number(button.dataset.step))};
}
$('printBtn').onclick=async()=>{if($('approval').value&&$('approval').value.length!==10){$('approval').setCustomValidity('核准編號請填滿 10 碼數字');$('approval').reportValidity();return}if(!fit()){$('warning').scrollIntoView();return}await document.fonts.ready;if(!fit()){$('warning').scrollIntoView();return}stamp();window.print()};$('approval').oninput=()=> $('approval').setCustomValidity('');window.addEventListener('beforeprint',()=>{stamp();fit()});new ResizeObserver(fit).observe(details);document.fonts.addEventListener('loadingdone',fit);render();

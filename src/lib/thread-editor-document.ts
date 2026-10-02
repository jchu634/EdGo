/** Local WebView document. XML is parsed as data and never inserted as HTML. */
export const THREAD_EDITOR_HTML = String.raw`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111827;--panel:#f3f4f6;--border:#d1d5db}
@media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#f1f5f9;--panel:#262626;--border:#525252}}
:root[data-theme=light]{color-scheme:light;--bg:#fff;--fg:#111827;--panel:#f3f4f6;--border:#d1d5db}
:root[data-theme=dark]{color-scheme:dark;--bg:#111;--fg:#f1f5f9;--panel:#262626;--border:#525252}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 Georgia,serif}
#editor{min-height:260px;padding:14px;outline:none;overflow-wrap:anywhere}#editor:empty:before{content:'Write your thread…';color:#888;pointer-events:none}
p{margin:0 0 12px;min-height:1.6em}h1,h2,h3,h4{line-height:1.25}a{color:#7e22ce}mark{background:#fde68a;color:#111}
code,pre,textarea{font-family:monospace}code{background:var(--panel);border-radius:4px;padding:2px 4px}pre{overflow:auto;white-space:pre;margin:0}pre code{padding:0}
figure[data-atomic]{margin:10px 0;padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:10px}
.block-preview{overflow:auto}math{font-size:22px}button{font:14px system-ui;min-height:40px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg);padding:6px 12px;margin:8px 6px 0 0}
img{display:block;max-width:100%;height:auto}.file{font-family:system-ui}blockquote,aside{border-left:4px solid #a855f7;padding:8px 12px;margin:10px 0;background:var(--panel)}details{padding:8px;border:1px solid var(--border);border-radius:8px}
dialog{width:calc(100% - 20px);max-width:700px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:12px;padding:16px}dialog::backdrop{background:#0008}textarea,input{width:100%;font-size:16px;color:var(--fg);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px}textarea{min-height:140px}label{display:block;margin:8px 0}
#problem{font:14px system-ui;color:#dc2626;padding:12px;display:none}
</style></head><body><div id="problem" role="alert"></div><div id="editor" role="textbox" aria-label="Thread content" aria-multiline="true" contenteditable="true"></div>
<dialog id="block-dialog"><form method="dialog"><label id="block-label" for="block-text">Content</label><textarea id="block-text"></textarea><label id="language-label" for="block-language">Language<input id="block-language" value="txt"></label><button id="apply-block" value="apply">Apply changes</button><button value="cancel">Cancel</button></form></dialog>
<script>
(function(){
  const editor=document.getElementById('editor'),problem=document.getElementById('problem');
  const dialog=document.getElementById('block-dialog'),blockText=document.getElementById('block-text'),blockLanguage=document.getElementById('block-language');
  let original='<document><paragraph></paragraph></document>',dirty=false,savedRange=null,counter=0,editingBlock=null,readOnly=false;
  const serializer=new XMLSerializer();
  function send(message){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));else window.dispatchEvent(new CustomEvent('editor-message',{detail:message}));}
  function height(){send({type:'height',height:Math.max(280,document.body.scrollHeight)});}
  function xmlParse(xml){if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Document declarations and custom entities are not supported.');const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='document')throw Error('This draft contains invalid XML. Its content has been preserved.');return doc;}
  function attrsOf(node){return Object.fromEntries(Array.from(node.attributes).map(a=>[a.name,a.value]));}
  function metadata(html,xml){html.dataset.edTag=xml.tagName;html.dataset.edAttrs=JSON.stringify(attrsOf(xml));return html;}
  const inlineTags={bold:'strong',b:'strong',italic:'em',i:'em',underline:'u',u:'u',strikethrough:'s',strike:'s',code:'code',mark:'mark',highlight:'mark',link:'a',break:'br',br:'br'};
  const blockTags={paragraph:'p',p:'p','list-item':'li',li:'li',callout:'aside',spoiler:'details',figure:'div'};
  function decorateBlock(block){
    const tag=block.dataset.edTag,xml=new DOMParser().parseFromString(block.dataset.edXml,'application/xml').documentElement;
    const preview=document.createElement('div');preview.className='block-preview';
    if(tag==='snippet'||tag==='codeblock'||tag==='pre'){
      const code=document.createElement('code'),pre=document.createElement('pre');code.textContent=(xml.querySelector('snippet-file')||xml).textContent;pre.appendChild(code);preview.appendChild(pre);
      block.dataset.source=code.textContent;send({type:'decorate',id:block.id,kind:'code',source:code.textContent,language:xml.getAttribute('language')||'txt'});
    }else if(tag==='math'){
      preview.textContent=xml.textContent;block.dataset.source=xml.textContent;send({type:'decorate',id:block.id,kind:'math',source:xml.textContent});
    }else if(tag==='image'){
      const image=document.createElement('img');const src=xml.getAttribute('src')||'';if(src.startsWith('https://'))image.src=src;image.alt=xml.getAttribute('alt')||'Attached image';preview.appendChild(image);
    }else if(tag==='file'){
      preview.className+=' file';preview.textContent=xml.getAttribute('filename')||'Attached file';
    }else{preview.textContent=xml.textContent||'Embedded '+tag;}
    block.replaceChildren(preview);
    if(['snippet','codeblock','pre','math'].includes(tag)){
      const edit=document.createElement('button');edit.type='button';edit.textContent=tag==='math'?'Edit equation':'Edit code';edit.disabled=readOnly;edit.onclick=()=>openBlock(block);block.appendChild(edit);
    }
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove '+(tag==='math'?'equation':tag==='snippet'?'code block':tag);remove.disabled=readOnly;remove.onclick=()=>{block.remove();publish();};block.appendChild(remove);
    height();
  }
  function renderNode(node){
    if(node.nodeType===3||node.nodeType===4)return document.createTextNode(node.nodeValue);
    if(node.nodeType===8){const comment=document.createElement('span');comment.hidden=true;comment.dataset.edXml=serializer.serializeToString(node);return comment;}
    if(node.nodeType!==1)return document.createTextNode('');
    const tag=node.tagName;
    let htmlTag=inlineTags[tag]||blockTags[tag];
    if(tag==='heading')htmlTag='h'+Math.min(4,Math.max(1,Number(node.getAttribute('number'))||2));
    if(tag==='list')htmlTag=node.getAttribute('style')==='number'?'ol':'ul';
    if(!htmlTag){
      const block=metadata(document.createElement('figure'),node);block.dataset.atomic='true';block.contentEditable='false';block.dataset.edXml=serializer.serializeToString(node);block.id='ed-block-'+(++counter);
      // Decoration happens after insertion, so native replies can locate the block.
      return block;
    }
    const html=metadata(document.createElement(htmlTag),node);
    if(tag==='link'){const href=node.getAttribute('href')||'';if(href.startsWith('https://')||href.startsWith('http://'))html.href=href;}
    if(tag==='spoiler'){html.open=true;const summary=document.createElement('summary');summary.textContent='Spoiler';summary.dataset.editorUi='true';summary.contentEditable='false';html.appendChild(summary);}
    for(const child of node.childNodes)html.appendChild(renderNode(child));
    return html;
  }
  function safeAttrs(xml,attrs){for(const [key,value]of Object.entries(attrs))xml.setAttribute(key,value);}
  function serializeNode(node,doc){
    if(node.nodeType===3)return doc.createTextNode(node.nodeValue.split(String.fromCharCode(160)).join(' '));
    if(node.nodeType!==1)return null;
    if(node.dataset.editorUi)return null;
    if(node.dataset.edXml){const fragment=new DOMParser().parseFromString('<document>'+node.dataset.edXml+'</document>','application/xml');return doc.importNode(fragment.documentElement.firstChild,true);}
    const tag=node.tagName.toLowerCase();
    const generated={p:'paragraph',div:'paragraph',strong:'bold',b:'bold',em:'italic',i:'italic',u:'underline',s:'strikethrough',strike:'strikethrough',code:'code',mark:'mark',a:'link',br:'break',ul:'list',ol:'list',li:'list-item',blockquote:'callout'};
    let edTag=node.dataset.edTag||generated[tag]||(/^h[1-4]$/.test(tag)?'heading':null);
    // Browsers use styled spans for highlight and sometimes for inline marks.
    const marks=[];
    if(node.style.backgroundColor)marks.push('mark');
    if(node.style.fontWeight==='bold'||Number(node.style.fontWeight)>=600)marks.push('bold');
    if(node.style.fontStyle==='italic')marks.push('italic');
    if(node.style.textDecoration.includes('underline'))marks.push('underline');
    if(node.style.textDecoration.includes('line-through'))marks.push('strikethrough');
    const xml=edTag?doc.createElement(edTag):doc.createDocumentFragment();
    if(edTag){
      const attrs=node.dataset.edAttrs?JSON.parse(node.dataset.edAttrs):{};safeAttrs(xml,attrs);
      if(edTag==='list')xml.setAttribute('style',tag==='ol'?'number':'bullet');
      if(edTag==='heading')xml.setAttribute('number',tag.slice(1));
      if(edTag==='link'){const href=node.getAttribute('href')||attrs.href||'';if(href.startsWith('https://')||href.startsWith('http://'))xml.setAttribute('href',href);}
      if(edTag==='callout'&&!xml.hasAttribute('type'))xml.setAttribute('type','info');
    }
    let destination=xml;
    for(const mark of marks){const wrapper=doc.createElement(mark);destination.appendChild(wrapper);destination=wrapper;}
    for(const child of node.childNodes){const value=serializeNode(child,doc);if(value)destination.appendChild(value);}
    return xml;
  }
  function getContent(){
    if(!dirty)return original;
    const doc=document.implementation.createDocument(null,'document');
    const originalRoot=xmlParse(original).documentElement;safeAttrs(doc.documentElement,attrsOf(originalRoot));
    for(const child of editor.childNodes){const value=serializeNode(child,doc);if(value)doc.documentElement.appendChild(value);}
    return serializer.serializeToString(doc);
  }
  function publish(){dirty=true;send({type:'change',content:getContent()});height();}
  function setContent(content){
    try{
      const doc=xmlParse(content);original=content;dirty=false;savedRange=null;editor.replaceChildren();
      for(const child of doc.documentElement.childNodes)editor.appendChild(renderNode(child));
      if(!editor.querySelector('p,h1,h2,h3,h4,li'))editor.appendChild(document.createElement('p'));
      problem.style.display='none';editor.querySelectorAll('[data-atomic]').forEach(decorateBlock);height();
    }catch(error){original=content;dirty=false;editor.replaceChildren();problem.textContent=error.message;problem.style.display='block';send({type:'error',message:error.message});}
  }
  function restoreSelection(){
    editor.focus();const selection=window.getSelection();
    if(savedRange&&editor.contains(savedRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(savedRange);}
    else{const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}
  }
  function format(mark){
    if(readOnly)return;restoreSelection();document.execCommand('styleWithCSS',false,false);
    const commands={bold:'bold',italic:'italic',underline:'underline',strikethrough:'strikeThrough',mark:'hiliteColor'};
    if(mark==='code'){
      const selection=window.getSelection(),range=selection.getRangeAt(0),wrapper=document.createElement('code');wrapper.appendChild(range.extractContents());range.insertNode(wrapper);range.selectNodeContents(wrapper);selection.removeAllRanges();selection.addRange(range);
    }else if(commands[mark])document.execCommand(commands[mark],false,mark==='mark'?'#fde68a':null);
    publish();
  }
  function openBlock(block){
    if(readOnly)return;editingBlock=block;
    const xml=new DOMParser().parseFromString(block.dataset.edXml,'application/xml').documentElement;
    const math=xml.tagName==='math';document.getElementById('block-label').textContent=math?'LaTeX equation':'Code';document.getElementById('language-label').hidden=math;
    blockText.value=(xml.querySelector('snippet-file')||xml).textContent;blockLanguage.value=xml.getAttribute('language')||'txt';dialog.showModal();blockText.focus();
  }
  function applyBlock(){
    if(!editingBlock)return;
    const xml=new DOMParser().parseFromString(editingBlock.dataset.edXml,'application/xml').documentElement;
    if(xml.tagName==='snippet'){
      let file=xml.querySelector('snippet-file');if(!file){file=xml.ownerDocument.createElement('snippet-file');xml.appendChild(file);}file.textContent=blockText.value;xml.setAttribute('language',blockLanguage.value||'txt');
    }else{xml.textContent=blockText.value;if(xml.tagName!=='math')xml.setAttribute('language',blockLanguage.value||'txt');}
    editingBlock.dataset.edXml=serializer.serializeToString(xml);decorateBlock(editingBlock);publish();editingBlock=null;
  }
  dialog.addEventListener('close',()=>{if(dialog.returnValue==='apply')applyBlock();else editingBlock=null;});
  editor.addEventListener('input',publish);
  editor.addEventListener('paste',event=>{event.preventDefault();if(!readOnly)document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
  editor.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
  document.addEventListener('selectionchange',()=>{const selection=window.getSelection();if(selection.rangeCount&&editor.contains(selection.anchorNode))savedRange=selection.getRangeAt(0).cloneRange();});
  new ResizeObserver(height).observe(editor);
  window.threadEditor={
    setContent,getContent,format,
    setTheme(value){document.documentElement.dataset.theme=value;},
    refreshDecorations(){editor.querySelectorAll('[data-atomic]').forEach(decorateBlock);},
    setReadOnly(value){readOnly=value;editor.contentEditable=String(!value);editor.querySelectorAll('button').forEach(button=>button.disabled=value);},
    decorate(id,source,html){const block=document.getElementById(id);if(block&&block.dataset.source===source){const preview=block.querySelector('.block-preview');preview.innerHTML=html;height();}},
    flush(requestId){if(dialog.open){applyBlock();dialog.close();}send({type:'flush',requestId,content:getContent()});}
  };
  send({type:'ready'});
})();
</script></body></html>`;

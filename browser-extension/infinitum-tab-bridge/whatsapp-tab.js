// Injected only into explicitly granted https://web.whatsapp.com tab.
// Do not access cookies, tokens, all chats, background messages or clipboard.
// WhatsApp Web changes its DOM periodically; fail closed if unknown.
export function inspectCurrentWhatsappTab(){
 const main=document.querySelector('#main');
 if(!main)return {ok:false,reason:'Abra uma conversa no WhatsApp Web antes de ler.'};
 const header=main.querySelector('header');
 const title=(header?.querySelector('span[title]')?.getAttribute('title')||
  header?.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent||
  header?.innerText?.split('\n')[0]||'').trim().slice(0,120);
 if(!title)return {ok:false,reason:'Não foi possível identificar a conversa aberta.'};
 const nodes=Array.from(main.querySelectorAll('[data-pre-plain-text]')).slice(-8);
 const messages=nodes.map(node=>{
  const preferred=node.querySelector('.selectable-text,[data-testid="msg-text"]');
  const raw=preferred?.innerText||preferred?.textContent||node.innerText||node.textContent||'';
  const out=Boolean(node.closest('.message-out'));
  return {text:String(raw).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,260),direction:out?'out':'in'};
 }).filter(item=>item.text);
 return {ok:true,title,messages,warning:'Título e histórico visíveis não confirmam a identidade do cliente ou fatos processuais.'};
}
export function insertWhatsappComposerDraft(text,expectedTitle){
 const main=document.querySelector('#main');
 if(!main)return {ok:false,reason:'Abra uma conversa no WhatsApp Web.'};
 const header=main.querySelector('header');
 const openTitle=(header?.querySelector('span[title]')?.getAttribute('title')||
  header?.querySelector('[data-testid="conversation-info-header-chat-title"]')?.textContent||
  header?.innerText?.split('\\n')[0]||'').trim().slice(0,120);
 if(!expectedTitle||openTitle!==expectedTitle)
  return {ok:false,reason:'A conversa mudou desde a leitura. Abra a conversa correta e atualize antes de preparar o texto.'};
 const composer=main.querySelector('footer [contenteditable="true"][role="textbox"],footer [contenteditable="true"]');
 if(!composer)return {ok:false,reason:'Caixa de mensagem não localizada. Nenhuma ação realizada.'};
 if(composer.textContent?.trim())return {ok:false,reason:'A conversa já possui um rascunho. Nenhum texto existente foi sobrescrito.'};
 if(typeof text!=='string'||!text.trim()||text.length>3000)
  return {ok:false,reason:'Rascunho inválido.'};
 composer.focus();
 const inserted=document.execCommand('insertText',false,text.trim());
 if(!inserted||!composer.textContent?.includes(text.trim()))
  return {ok:false,reason:'Não foi possível inserir o texto na interface atual. Nenhuma mensagem foi enviada.'};
 return {ok:true,prepared:true,submitted:false,warning:'Texto inserido como rascunho. Confira o destinatário e clique em Enviar manualmente no WhatsApp.'};
}

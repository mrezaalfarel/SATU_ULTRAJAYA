import {app,api,busy,esc,go,heading,toast} from '/app.js';

const labels={normal:'Tampak normal',abnormal:'Indikasi abnormal',uncertain:'Belum dapat dipastikan'};

async function imageData(file){
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>1048576)throw Error('Pilih foto JPG atau PNG hingga 1 MiB.');
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(',')[1]);
  reader.onerror=()=>reject(Error('Foto gagal dibaca.'));
  reader.readAsDataURL(file);
 });
}

export async function ask(host){
 const session=await api('me');
 if(!host.isConnected)return;
 const memory=app.chatMemory;
 const thread=memory.thread&&Date.now()-memory.left<=15000?memory.thread:crypto.randomUUID();
 memory.thread=thread;memory.left=0;
 const conversations=await api('chat_list');
 if(!host.isConnected)return;
 host.classList.add('chat-page');
 host.innerHTML=heading('AI Corner','','Asisten produksi','<button class="outline" type="button" id="clearChat">Percakapan baru</button>')+
  '<div class="chat-layout"><section class="chat-history panel"><h2>Riwayat</h2><div id="threadList"></div></section><div class="chat-sheet"><div class="chat-welcome"><span aria-hidden="true">✧</span><h2>Apa yang ingin Anda periksa?</h2></div><div id="conversation" role="log" aria-live="polite"></div>'+
  '<form class="composer">'+
  '<textarea name="q" rows="2" maxlength="800" aria-label="Pertanyaan" placeholder="Tulis pertanyaan atau diktekan pesan…" required></textarea>'+
  (session.vision?`<div class="attachment-tools" id="attachMenu" hidden>
   <button type="button" class="outline" id="pickDoc">Dokumen TXT, MD, CSV</button><input type="file" name="document" accept=".txt,.md,.csv" hidden>
   <button type="button" class="outline" id="pickPhoto">Foto JPG atau PNG</button><input type="file" name="photo" accept="image/png,image/jpeg" hidden>
   <button type="button" class="outline" id="cameraOpen">Buka kamera</button></div>
   <div class="actions"><button type="button" class="outline" id="cameraGrab" hidden>Ambil foto</button><button type="button" class="text-btn" id="cameraClose" hidden>Tutup kamera</button></div>
   <video id="cameraPreview" class="ai-photo" muted autoplay playsinline hidden></video><img class="ai-photo" id="capturePreview" alt="Foto yang akan dikirim" hidden>
   <button type="button" class="text-btn" id="removePhoto" hidden>Batalkan foto</button>
   <button type="button" class="text-btn" id="removeDoc" hidden></button>
   <label class="inlinecheck" hidden id="repeatPhoto"><input type="checkbox" id="useLastPhoto"> Sertakan lagi foto terakhir</label>`:'')+
  '<div class="compose-actions">'+(session.vision?'<button class="tool-btn" id="attachToggle" type="button" aria-label="Tambah lampiran" aria-controls="attachMenu" aria-expanded="false">＋</button>':'')+
  '<button type="button" class="tool-btn" id="mic" aria-label="Dikte bahasa Indonesia" aria-pressed="false" title="Dikte bahasa Indonesia">🎙</button><span id="voiceStatus" role="status"></span><button class="primary" name="send">Kirim ↑</button></div></form></div></div>';
 const select=s=>host.querySelector(s);
 const form=select('form'),log=select('#conversation'),video=select('#cameraPreview'),preview=select('#capturePreview');
 let stream=null,frame=null,previewURL='',lastImage=null,generation=0,closed=false;
 let history=[];
 let speech=null;
 const mic=select('#mic'),voiceStatus=select('#voiceStatus');
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 let current=thread,readVersion=0;
 function renderTurn(q,answer,filename){
   const turn=document.createElement('article');turn.className='chat-turn stack';
   turn.innerHTML='<div class="chat-user">'+esc(q)+(filename?'<small>'+esc(filename)+'</small>':'')+'</div>'+
    (answer.assessment?'<strong>'+esc(labels[answer.assessment]||labels.uncertain)+'</strong>':'')+
    (answer.reply?'<p class="note">'+esc(answer.reply)+'</p>':'')+
    (answer.notice?'<p class="hint">'+esc(answer.notice)+'</p>':'')+
    (answer.assessment?'<p class="hint">Konfirmasikan temuan ke QC atau penanggung jawab mesin.</p>':'')+
    answer.docs.map((doc,i)=>'<details><summary>['+(i+1)+'] '+esc(doc.title)+' · Rev '+esc(doc.revision)+'</summary><p class="note">'+esc(doc.excerpt)+'</p><button class="text-btn" data-doc="'+esc(doc.id)+'">Buka modul</button></details>').join('');
   for(const button of turn.querySelectorAll('[data-doc]'))button.onclick=()=>go('education',{id:button.dataset.doc});
   log.append(turn);
   const summary=answer.reply||answer.docs.map(source=>source.title+' — '+source.excerpt).join('\n')||answer.notice;
   history=[...history,{question:q,answer:String(summary||'').slice(0,2400)}].slice(-4);
   return turn;
 }
 function drawThreads(){
  const target=select('#threadList');
  target.replaceChildren();
  for(const entry of conversations){
   const button=document.createElement('button');button.type='button';button.textContent=entry.title;
   button.onclick=busy(button,async()=>{
    const version=++readVersion;
    const rows=await api('chat_read',{thread:entry.thread});
    if(closed||version!==readVersion)return;
    select('#clearChat').click();
    for(const row of rows)renderTurn(row.question,row.answer);
    // A reply from history starts a fresh conversation with the displayed context.
   });
   target.append(button);
  }
  if(!conversations.length)target.textContent='Belum ada percakapan.';
 }
 drawThreads();
 function stopVoice(){if(speech){speech.abort();speech=null;}mic.setAttribute('aria-pressed','false');}
 mic.onclick=()=>{
  if(!Speech){voiceStatus.textContent='Dikte belum tersedia di browser ini.';return;}
  if(speech){speech.stop();return;}
  const recognition=new Speech();speech=recognition;
  recognition.lang='id-ID';recognition.interimResults=false;
  recognition.onresult=event=>{
   if(closed||speech!==recognition)return;
   const q=form.elements.q;
   q.value=(q.value+' '+event.results[event.resultIndex][0].transcript).trim().slice(0,800);
   voiceStatus.textContent='Periksa teks sebelum mengirim.';
  };
  recognition.onerror=()=>{if(!closed&&speech===recognition)voiceStatus.textContent='Dikte terhenti. Periksa izin mikrofon.';};
  recognition.onend=()=>{if(speech===recognition){speech=null;mic.setAttribute('aria-pressed','false');if(voiceStatus.textContent==='Mendengarkan…')voiceStatus.textContent='';}};
  try{recognition.start();mic.setAttribute('aria-pressed','true');voiceStatus.textContent='Mendengarkan…';}
  catch{stopVoice();voiceStatus.textContent='Mikrofon belum tersedia.';}
 };
 function resetDocument(){
  if(!form.elements.document)return;
  form.elements.document.value='';
  select('#removeDoc').hidden=true;
 }
 if(session.vision){
  const toggle=select('#attachToggle'),menu=select('#attachMenu');
  toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
  select('#pickPhoto').onclick=()=>form.elements.photo.click();
  select('#pickDoc').onclick=()=>form.elements.document.click();
  form.elements.document.onchange=()=>{
   const file=form.elements.document.files[0];
   if(!file){resetDocument();return;}
   if(!/\.(txt|md|csv)$/i.test(file.name)||file.size>48000){resetDocument();toast('Pilih TXT, MD, atau CSV hingga 48 KB.',true);return;}
   select('#removeDoc').hidden=false;select('#removeDoc').textContent='× '+file.name;
   voiceStatus.textContent='Lampiran dikirim bersama pesan. Maksimal 12.000 karakter.';
  };
  select('#removeDoc').onclick=resetDocument;
 }
 function stopCamera(){
  generation++;
  if(stream){for(const track of stream.getTracks())track.stop();stream=null;}
  if(video){
   video.srcObject=null;video.hidden=true;
   select('#cameraOpen').hidden=false;
   select('#cameraGrab').hidden=true;select('#cameraClose').hidden=true;
  }
 }
 function clearPhoto(){
  frame=null;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL='';}
  if(preview){preview.removeAttribute('src');preview.hidden=true;form.elements.photo.value='';select('#removePhoto').hidden=true;select('#useLastPhoto').checked=false;}
 }
 function showPhoto(blob){
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;
  select('#removePhoto').hidden=false;select('#useLastPhoto').checked=false;
 }
 const onVisibility=()=>{if(document.hidden){stopCamera();stopVoice();}};
 document.addEventListener('visibilitychange',onVisibility);
 window.addEventListener('pagehide',stopCamera);
 app.cleanup=()=>{
  closed=true;memory.left=Date.now();stopVoice();stopCamera();clearPhoto();history=[];lastImage=null;
  window.removeEventListener('pagehide',stopCamera);document.removeEventListener('visibilitychange',onVisibility);
 };
 if(video){
  const open=select('#cameraOpen'),grab=select('#cameraGrab');
  open.onclick=busy(open,async()=>{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera memerlukan HTTPS dan browser yang mendukungnya. Anda juga dapat mengunggah foto.');
   const gen=++generation;
   let next;
   try{next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});}
   catch{throw Error('Kamera belum dapat dibuka. Periksa izin kamera atau unggah foto.');}
   if(closed||gen!==generation||document.hidden){next.getTracks().forEach(track=>track.stop());return;}
   stream=next;video.srcObject=next;video.hidden=false;
   open.hidden=true;select('#cameraClose').hidden=false;
   try{await video.play();if(gen===generation)grab.hidden=false;}catch{stopCamera();throw Error('Pratinjau kamera gagal. Coba kembali atau unggah foto.');}
  });
  select('#cameraClose').onclick=stopCamera;
  grab.onclick=busy(grab,async()=>{
   if(!stream||!video.videoWidth)throw Error('Tunggu hingga gambar kamera tersedia.');
   const gen=generation;
   const scale=Math.min(1,1024/Math.max(video.videoWidth,video.videoHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));
   if(closed||gen!==generation)return;
   if(!blob||blob.size>1048576)throw Error('Foto gagal diambil. Coba lagi atau unggah foto.');
   clearPhoto();frame=blob;showPhoto(blob);stopCamera();
   if(!form.elements.q.value.trim())form.elements.q.value='Bagaimana kondisi visual objek ini berdasarkan manual?';
  });
  form.elements.photo.onchange=()=>{
   const file=form.elements.photo.files[0];frame=null;
   if(!file){clearPhoto();return;}
   if(!['image/png','image/jpeg'].includes(file.type)||file.size>1048576){clearPhoto();toast('Pilih JPG atau PNG hingga 1 MiB.',true);return;}
   stopCamera();showPhoto(file);
  };
  select('#removePhoto').onclick=clearPhoto;
  select('#useLastPhoto').onchange=e=>{
   if(e.target.checked){clearPhoto();e.target.checked=true;stopCamera();}
  };
 }
 select('#clearChat').onclick=()=>{current=crypto.randomUUID();memory.thread=current;stopVoice();voiceStatus.textContent='';stopCamera();resetDocument();clearPhoto();history=[];lastImage=null;form.reset();log.replaceChildren();if(video)select('#repeatPhoto').hidden=true;form.elements.q.focus();};
 const send=form.elements.send;
 form.onsubmit=busy(send,async()=>{
  stopVoice();
  const q=form.elements.q.value.trim();if(!q)throw Error('Isi pertanyaan terlebih dahulu.');
  const photo=frame||form.elements.photo?.files[0];
  readVersion++;
  const clearButton=select('#clearChat');clearButton.disabled=true;
  const controls=[...form.elements,...select('#threadList').querySelectorAll('button')].filter(el=>el!==send&&el!==clearButton);
  try{
   controls.forEach(el=>el.disabled=true);
   const image=photo?await imageData(photo):select('#useLastPhoto')?.checked?lastImage:undefined;
   if(closed)return;
   stopCamera();
   const file=form.elements.document?.files[0];
   const documentText=file?await file.text():'';
   if(file&&(!documentText.trim()||documentText.length>12000||documentText.includes('\u0000')))throw Error('Pilih dokumen teks berisi maksimal 12.000 karakter.');
   if(closed)return;
   const mode='auto';
   const context=history.map(({question,answer})=>({question,answer}));
   const answer=await api('ask',{q,image,document:documentText,history:context,mode,thread:current});
   if(closed)return;
   const turn=renderTurn(q,answer,file?.name);
   if(!conversations.some(t=>t.thread===current))conversations.unshift({thread:current,title:q});
   drawThreads();
   if(image){lastImage=image;select('#repeatPhoto').hidden=false;}
   form.elements.q.value='';clearPhoto();resetDocument();turn.scrollIntoView({block:'nearest'});
  }finally{controls.forEach(el=>el.disabled=false);clearButton.disabled=false;}
 });
 if(conversations.some(row=>row.thread===thread)){
  const prior=await api('chat_read',{thread});
  if(!closed&&current===thread&&!log.children.length)for(const row of prior)renderTurn(row.question,row.answer);
 }

}

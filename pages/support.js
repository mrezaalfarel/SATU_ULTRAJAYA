import {app,api,go,esc,fmt,heading,onBtn,busy,toast,adminArea,applyPrefs,signedOut,askDialog,language,drawNavigation,roleName} from '/app.js';
const options=(values,selected)=>values.map(v=>'<option '+(v===selected?'selected':'')+'>'+esc(v)+'</option>').join('');
const data=form=>Object.fromEntries(new FormData(form));
const categories={'Instruksi Kerja':'Instruksi Kerja',SOP:'Standar Operasional Prosedur',OPL:'One Point Lesson',General:'General',Tutorial:'Tutorial','Mini Quiz':'Mini Quiz'};
const docAreas=['General','Processing','Filling-Packing','Cleaning','Other'];
const roles=['operator','pengawas','foreman','qc','qa','ci','management','admin'];
const categoryName=value=>categories[value]||(['Book','Video'].includes(value)?'Tutorial':value);
async function education(host,args){
 host.classList.add('academy');
 if(args.edit)return moduleEditor(host,args.id,args.kind);
 if(args.id)return lesson(host,args.id);
 const category=args.category||'',sort=args.sort||'visits';
 const [items,rank]=await Promise.all([api('modules',{category}),api('leaderboard',{sort})]);
 if(!host.isConnected)return;
 let next=items.length>50;
 const seen=items.slice(0,50);
 const covers={'Instruksi Kerja':'mint',SOP:'violet',OPL:'peach',Tutorial:'blue','Mini Quiz':'rose'};
 const books='<span class="book-stack" aria-hidden="true"><i></i><i></i><i></i></span>';
 function draw(){
  const metrics={visits:'Jumlah akses',seconds:'Waktu baca',points:'Poin kuis'};
  const headingAction=adminArea()?'<button class="primary" id="add">+ Tambah modul</button>':'';
  const resume=seen.find(m=>m.active&&!m.completed&&m.seconds>0);
  host.innerHTML='<div class="academy-hero"><div><h1>Education Corner</h1><p>Halo, '+esc(app.person.name)+'. Pilih materi untuk shift Anda.</p>'+
   (resume?'<button class="outline" data-open="'+esc(resume.id)+'">Lanjutkan · '+esc(resume.title)+'</button>':'')+headingAction+'</div>'+books+'</div>'+
   '<div class="study-tabs" aria-label="Kategori modul">'+Object.entries({'':'Semua',...categories}).map(([key,label])=>`<button data-category="${esc(key)}" aria-pressed="${category===key}">${esc(label)}</button>`).join('')+'</div>'+
   '<div class="study-layout"><section><h2 class="section-title">'+esc(categories[category]||'Semua modul')+'</h2><div class="portal-grid">'+seen.map(m=>`<article class="portal-card book"><div class="course-cover ${covers[m.category]||'blue'}">${books}</div><small>${esc(categoryName(m.category))} · Rev ${esc(m.revision)}</small><strong>${esc(m.title)}</strong><small>${!m.active?'Diarsipkan':m.completed?'Selesai':m.seconds?fmt(Math.floor(m.seconds/60))+' menit aktif':'Belum selesai'}</small><div class="actions">${m.active?'<button class="outline" data-open="'+esc(m.id)+'">Buka</button>':''}${adminArea()?'<button class="text-btn" data-edit="'+esc(m.id)+'">Edit</button>':''}</div></article>`).join('')+'</div>'+
   (seen.length?'':'<p class="empty">Belum ada modul dalam kategori ini.</p>')+(next?'<button id="more" class="outline">Muat berikutnya</button>':'')+'</section>'+
   '<section class="panel learning-rank"><h2 class="section-title">Leaderboard belajar</h2><label>Urutkan berdasarkan<select id="rankMetric">'+Object.entries(metrics).map(([k,v])=>`<option value="${k}" ${sort===k?'selected':''}>${v}</option>`).join('')+'</select></label>'+
   (sort==='points'?'<p class="muted">Jumlah nilai terbaik tiap kuis, maksimal 100 poin per modul.</p>':'')+
   '<ol>'+rank.map(x=>`<li><strong>${esc(x.name)}</strong><span>${sort==='points'?fmt(x.points)+' poin':sort==='visits'?fmt(x.visits)+' akses':fmt(Math.floor(x.seconds/60))+' mnt '+fmt(x.seconds%60)+' dtk'}</span></li>`).join('')+'</ol>'+
   (rank.length?'':'<p class="muted">Belum ada aktivitas untuk ditampilkan.</p>')+'</section></div>';
  host.querySelector('#rankMetric').onchange=e=>go('education',{category,sort:e.target.value});
  onBtn(host,'[data-category]',b=>go('education',{category:b.dataset.category,sort}));
  onBtn(host,'#add',()=>go('education',{edit:true,kind:category}));
  onBtn(host,'[data-open]',b=>go('education',{id:b.dataset.open}));
  onBtn(host,'[data-edit]',b=>go('education',{edit:true,id:b.dataset.edit}));
  onBtn(host,'#more',async()=>{const last=seen.at(-1),list=await api('modules',{category,after:last.title,after_id:last.id});seen.push(...list.slice(0,50));next=list.length>50;draw();});
 }
 draw();
}
function preview(m){
 if(!m.attachment)return '';
 const url='/api/file?id='+encodeURIComponent(m.id)+'&preview=1',ext=m.attachment.split('.').pop();
 const view=ext==='pdf'?'<iframe loading="lazy" title="Pratinjau PDF" src="'+url+'"></iframe>':
  ext==='mp4'?'<video controls preload="metadata" src="'+url+'"></video>':'<img alt="Pratinjau dokumen" src="'+url+'">';
 return '<section class="document-preview">'+view+'<div class="actions"><a class="outline" href="'+url+'" target="_blank" rel="noopener">Buka pratinjau</a><a class="text-btn" href="/api/file?id='+encodeURIComponent(m.id)+'">Unduh lampiran</a></div></section>';
}
async function lesson(host,id){
 const m=await api('module',{id});await api('visit',{id});if(!host.isConnected)return;
 host.innerHTML=heading(m.title,m.category+' · Revisi '+m.revision,'Education Corner','<button class="outline" id="back">Kembali ke modul</button>')+
 '<article class="panel"><div class="doc-meta">'+[m.doc_no,m.doc_area].filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('')+'</div><p class="note">'+esc(m.body)+'</p>'+preview(m)+'</article>'+

 (m.questions.length?'<form class="panel"><h3>Mini quiz</h3>'+m.questions.map((q,i)=>'<fieldset><legend>'+esc(q.text)+'</legend>'+q.options.map((v,j)=>`<label class="inlinecheck"><input required type="radio" name="q${i}" value="${j}">${esc(v)}</label>`).join('')+'</fieldset>').join('')+'<div class="actions"><button class="primary">Periksa jawaban</button><span id="score" role="status"></span></div></form>':'')+
 '<div class="actions"><button id="finish" class="outline">Tandai selesai</button></div>';
 onBtn(host,'#back',()=>go('education'));onBtn(host,'#finish',async()=>{await api('finish',{id,revision:m.revision,edition:m.edition});toast('Modul ditandai selesai.');await go('education');});
 const f=host.querySelector('form');if(f)f.onsubmit=busy(f.querySelector('button'),async()=>{const q=data(f);const x=await api('quiz',{id,revision:m.revision,edition:m.edition,answers:m.questions.map((_,i)=>Number(q['q'+i]))});host.querySelector('#score').textContent='Nilai '+x.score+'/100 · '+(x.passed?'Lulus':'Pelajari kembali materi');});
 let started=null,accrued=0;
 function recordTime(){
  const now=performance.now();
  if(started!==null)accrued+=now-started;
  started=!document.hidden&&document.hasFocus()?now:null;
 }
 function flushTime(){
  recordTime();
  const seconds=Math.min(40,Math.floor(accrued/1000));
  if(seconds<1)return;
  accrued-=seconds*1000;
  api('heartbeat',{id,seconds}).catch(()=>{});
 }
 recordTime();
 const tm=setInterval(flushTime,30000);
 window.addEventListener('focus',recordTime);
 window.addEventListener('blur',flushTime);
 document.addEventListener('visibilitychange',flushTime);
 app.cleanup=()=>{
  clearInterval(tm);
  window.removeEventListener('focus',recordTime);
  window.removeEventListener('blur',flushTime);
  document.removeEventListener('visibilitychange',flushTime);
  if(app.person)flushTime();
 };

}
function queryForm(q={}){
 return `<fieldset class="question"><legend>Pertanyaan</legend><label>Teks pertanyaan<input class="qt" maxlength="400" value="${esc(q.text)}" required></label><label>Pilihan jawaban · satu pilihan per baris<textarea class="qo" rows="3" required>${esc((q.options||[]).join('\n'))}</textarea></label><label>Nomor pilihan yang benar<input class="qc" type="number" min="1" max="5" required value="${(q.correct??0)+1}"></label><button type="button" class="text-btn rm">Hapus pertanyaan</button></fieldset>`;
}
async function moduleEditor(host,id,kind){
 if(!adminArea())throw Error('Akses pengelola diperlukan.');
 const m=id?await api('module',{id,edit:true}):{id:crypto.randomUUID(),category:Object.hasOwn(categories,kind)?kind:'SOP',active:true,revision:'01',questions:[]};
 host.innerHTML=heading(id?'Ubah modul':'Tambah modul','','Education Corner')+`<form class="panel stack"><div class="fields"><label>Judul dokumen<input name="title" required maxlength="140" value="${esc(m.title)}"></label><label>Nomor dokumen<input name="doc_no" maxlength="100" required value="${esc(m.doc_no)}"></label><label>Kategori dokumen<select name="category">${Object.entries(categories).filter(([key])=>['Instruksi Kerja','SOP','OPL','General',m.category].includes(key)).map(([key,label])=>'<option value="'+esc(key)+'" '+(categoryName(key)===categoryName(m.category)?'selected':'')+'>'+esc(label)+'</option>').join('')}</select></label><label>Kategori area<select name="doc_area">${options(docAreas,m.doc_area||'General')}</select></label><label>Revisi<input name="revision" maxlength="40" required value="${esc(m.revision)}"></label></div><label>Catatan<textarea name="body" maxlength="60000" rows="9">${esc(m.body)}</textarea></label><label>Lampiran materi<small>Untuk SOP dan instruksi kerja, unggah PDF hingga 12 MiB. JPG, PNG, dan MP4 juga didukung. File tersimpan di penyimpanan privat SATU.</small><input name="blob" type="file" accept=".pdf,.jpg,.jpeg,.png,.mp4"></label>${m.attachment?'<label class="inlinecheck"><input type="checkbox" name="remove">Lepas lampiran saat ini</label>':''}<label class="inlinecheck"><input type="checkbox" name="active" ${m.active?'checked':''}> Terbitkan modul</label><div class="questions">${m.questions.map(queryForm).join('')}</div><button type="button" class="outline addq">+ Tambah pertanyaan</button><div class="actions"><button class="primary" type="submit">Simpan modul</button><button type="button" class="outline back">Kembali</button></div></form>`;
 if(!host.isConnected)return;
 let dirty=false,pending=null;app.isDirty=()=>dirty;const form=host.querySelector('form');form.oninput=()=>{dirty=true;};
 form.addEventListener('click',e=>{if(e.target.matches('.rm')){e.target.closest('.question').remove();dirty=true;}if(e.target.matches('.addq')){if(form.querySelectorAll('.question').length>=20)return toast('Maksimal 20 pertanyaan.');form.querySelector('.questions').insertAdjacentHTML('beforeend',queryForm());dirty=true;}});
 onBtn(form,'.back',()=>go('education'));form.onsubmit=busy(form.querySelector('[type=submit]'),async()=>{
  const d=data(form),file=form.elements.blob.files[0];let attachment=form.elements.remove?.checked?'':m.attachment||'';
  const qs=[...form.querySelectorAll('.question')].map(el=>({text:el.querySelector('.qt').value,options:el.querySelector('.qo').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),correct:Number(el.querySelector('.qc').value)-1}));
  if(qs.some(q=>q.options.length<2||q.options.length>5||q.correct<0||q.correct>=q.options.length))throw Error('Setiap soal perlu 2–5 pilihan dan nomor jawaban yang sesuai.');
  if(file){if(file.size>12*1024*1024)throw Error('Lampiran melebihi 12 MiB.');if(pending?.file!==file){const ext=file.name.toLowerCase().split('.').pop().replace('jpeg','jpg');const res=await fetch('/api/upload?module='+m.id+'&ext='+encodeURIComponent(ext),{method:'POST',body:file});const x=await res.json();if(!res.ok)throw Error(x.error||'Unggah lampiran gagal.');pending={file,key:x.attachment,extracted:x.extracted,notice:x.notice};}attachment=pending.key;}
  await api('module_save',{id:m.id,title:d.title,category:d.category,revision:d.revision,body:d.body,questions:qs,doc_no:d.doc_no,doc_area:d.doc_area,...(file?{extracted:pending.extracted}:{}),manual:true,active:!!d.active,attachment});dirty=false;toast(file&&pending.notice?'Modul tersimpan. '+pending.notice:'Modul tersimpan.');await go('education',{},true);
 });
}
async function management(host){
 if(!adminArea())throw Error('Akses management diperlukan.');
 const [initial,notices]=await Promise.all([api('people'),api('notice_manage')]);let more=initial.length>50;const employees=initial.slice(0,50),isAdmin=app.person.role==='admin';
 host.innerHTML=heading('Management Area','Kelola pengumuman pabrik dan akses karyawan.','Pengelolaan')+
 '<div class="manage-widgets"><button class="portal-card" id="teamWidget"><strong>Kelola karyawan</strong><small>ID, peran, area dan status akses →</small></button><button class="portal-card" id="infoWidget"><strong>Satu Informasi</strong><small>Jadwal terbit dan penerima pengumuman →</small></button></div><div class="panel" id="accounts"></div><div id="editor"></div><section class="panel"><div class="spread"><h3>Pengumuman</h3><button class="outline" id="notice">+ Pengumuman</button></div><div id="notes"></div></section>';
 host.querySelector('#teamWidget').onclick=()=>host.querySelector('#accounts').scrollIntoView();
 host.querySelector('#infoWidget').onclick=()=>host.querySelector('#notice').focus();
 function users(){const el=host.querySelector('#accounts');el.innerHTML='<div class="spread"><h3>Direktori karyawan</h3>'+(isAdmin?'<button class="primary" id="addUser">+ Karyawan</button>':'')+'</div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Nama</th><th>Peran dan area</th><th>Line produksi</th><th>Status</th><th></th></tr></thead><tbody>'+employees.map(p=>`<tr><td>${esc(p.employee)}</td><td>${esc(p.name)}</td><td>${esc(roleName(p.role))}<br><small>${esc(p.workArea)}</small></td><td>${esc((p.productionLines||[]).join(', ')||'—')}</td><td>${p.active?'Aktif':'Nonaktif'}</td><td>${isAdmin?'<button class="text-btn" data-id="'+p.id+'">Ubah</button>'+((p.active&&p.id!==app.person.id)?'<button class="text-btn" data-remove="'+p.id+'">Hapus akses</button>':'')+'':''}</td></tr>`).join('')+'</tbody></table></div>'+(more?'<button id="more" class="outline">Muat berikutnya</button>':'');
  onBtn(el,'[data-remove]',async b=>{
   const p=employees.find(row=>row.id===b.dataset.remove);
   if(await askDialog('Nonaktifkan akses '+p.name+'? Riwayat laporan tetap tersimpan.','Hapus akses')){
    await api('account',{...p,active:false});await go('management',{},true);
   }
  });
  onBtn(el,'#addUser',()=>editUser({}));onBtn(el,'[data-id]',b=>editUser(employees.find(p=>p.id===b.dataset.id)));onBtn(el,'#more',async()=>{const next=await api('people',{after:employees.at(-1).employee});employees.push(...next.slice(0,50));more=next.length>50;users();});
 }
 function editUser(p){
  const editor=host.querySelector('#editor');
  const roleOptions=roles.map(role=>`<option value="${role}" ${role===(p.role||'operator')?'selected':''}>${esc(roleName(role))}</option>`).join('');
  editor.innerHTML=`<form class="panel"><h3>${p.id?'Ubah akses':'Daftarkan karyawan'}</h3>
   <div class="fields"><label>ID karyawan<input name="employee" required maxlength="40" value="${esc(p.employee)}" ${p.id?'readonly':''}></label>
   <label>Nama<input name="name" required maxlength="100" value="${esc(p.name)}"></label>
   <label>Peran<select name="role">${roleOptions}</select></label>
   <label id="areaField">Area kerja<select name="workArea"></select></label>
   <label>Line produksi yang diizinkan<input name="lineNames" value="${esc((p.productionLines||[]).join(', '))}" maxlength="3280"><small>Pisahkan nama line dengan koma.</small></label>
   <label id="supervisorField">Pengawas yang membawahi foreman<select name="supervisorId"></select><small class="availability" role="status"></small></label>
   ${!p.id?'<label>Kata sandi awal<input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="128"></label>':''}</div>
   <div class="actions"><label class="inlinecheck"><input type="checkbox" name="active" ${p.active!==false?'checked':''}>Aktif</label><button class="primary">Simpan akun</button></div></form>
   ${p.id&&p.id!==app.person.id?'<form class="panel" id="reset"><label>Kata sandi baru<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><div class="actions"><button class="outline">Reset kata sandi</button></div></form>':''}`;
  editor.scrollIntoView();
  const f=editor.querySelector('form'),fields=f.elements;
  const supervisorField=f.querySelector('#supervisorField'),availability=supervisorField.querySelector('.availability');
  const lines=()=>[...new Set(fields.lineNames.value.split(',').map(x=>x.trim()).filter(Boolean))];
  let areaRequest=0,candidates=[],waiting=false,selectedSupervisor=p.supervisorId||'';
  function drawSupervisors(){
   const requiredLines=lines();
   const eligible=candidates.filter(s=>s.active&&s.id!==p.id&&requiredLines.every(line=>s.productionLines?.includes(line)));
   fields.supervisorId.replaceChildren(new Option('Pilih pengawas',''),...eligible.map(s=>new Option(s.name+' · '+s.employee,s.id)));
   if(eligible.some(s=>s.id===selectedSupervisor))fields.supervisorId.value=selectedSupervisor;
   if(!waiting)availability.textContent=eligible.length?'Satu pengawas dapat membawahi hingga empat foreman aktif.':'Belum ada pengawas aktif untuk kombinasi area dan line ini.';
  }
  async function loadSupervisors(){
   const seq=++areaRequest,area=fields.workArea.value;
   candidates=[];waiting=false;fields.supervisorId.replaceChildren(new Option('Pilih pengawas',''));
   if(fields.role.value!=='foreman'||!area){availability.textContent='Pilih area kerja terlebih dahulu.';return;}
   waiting=true;availability.textContent='Memuat pengawas…';
   const supervisors=[];
   try{
    let page;
    do{
     page=await api('supervisors',{workArea:area,after:supervisors.at(-1)?.employee});
     if(seq!==areaRequest||!f.isConnected)return;
     supervisors.push(...page.slice(0,50));
    }while(page.length>50);
    candidates=supervisors;waiting=false;drawSupervisors();
   }catch(err){if(seq===areaRequest&&f.isConnected){waiting=false;availability.textContent=err.message;toast(err.message,true);}}
  }
  function setRequired(){
   fields.workArea.required=!fields.workArea.disabled&&fields.active.checked;
   fields.lineNames.required=fields.workArea.required;
   fields.supervisorId.required=!fields.supervisorId.disabled&&fields.active.checked;
  }
  function changeRole(initialArea){
   const role=fields.role.value,restricted=['operator','pengawas','foreman'].includes(role);
   const choices=role==='operator'?['Filling','Sterilizer - Aseptic Tank','Proses','Packing']:['Filling - Packing','InProses','Proses'];
   fields.workArea.replaceChildren(new Option('Pilih area',''),...choices.map(x=>new Option(x,x)));
   if(choices.includes(initialArea))fields.workArea.value=initialArea;
   f.querySelector('#areaField').hidden=!restricted;fields.workArea.disabled=!restricted;
   supervisorField.hidden=role!=='foreman';fields.supervisorId.disabled=role!=='foreman';
   setRequired();loadSupervisors();
  }
  fields.role.onchange=()=>changeRole(fields.workArea.value);
  fields.workArea.onchange=loadSupervisors;
  fields.active.onchange=setRequired;
  fields.lineNames.oninput=()=>{if(fields.role.value==='foreman'&&!waiting)drawSupervisors();};
  fields.supervisorId.onchange=()=>{selectedSupervisor=fields.supervisorId.value;};
  changeRole(p.workArea);
  f.onsubmit=busy(f.querySelector('.primary'),async()=>{
   if(waiting)throw Error('Tunggu daftar pengawas selesai dimuat.');
   const {lineNames,...v}=data(f),productionLines=lines();
   if(fields.lineNames.required&&!productionLines.length)throw Error('Isi sedikitnya satu line untuk akun aktif.');
   await api('account',{...v,id:p.id,active:fields.active.checked,workArea:v.workArea||null,supervisorId:v.supervisorId||null,productionLines:productionLines.length?productionLines:null});
   if(p.id===app.person.id){signedOut();toast('Akses diperbarui. Masuk kembali.');}
   else{toast('Akun tersimpan.');await go('management',{},true);}
  });
  const reset=editor.querySelector('#reset');
  if(reset)reset.onsubmit=busy(reset.querySelector('button'),async()=>{await api('reset_password',{id:p.id,password:reset.elements.password.value});reset.reset();toast('Kata sandi direset. Sesi sebelumnya telah berakhir.');});
 }
 const notes=host.querySelector('#notes');notes.innerHTML=notices.map(n=>`<div class="book"><div><strong>${esc(n.title)}</strong><small>${n.active?'Aktif':'Diarsipkan'}</small><p class="note">${esc(n.body)}</p></div><button class="text-btn" data-note="${n.id}">Edit</button></div>`).join('')||'<p class="muted">Belum ada pengumuman.</p>';
 function note(n){const el=host.querySelector('#editor');el.innerHTML=`<form class="panel stack"><h3>Pengumuman pabrik</h3><label>Judul<input name="title" required maxlength="120" value="${esc(n.title)}"></label><label>Isi<textarea name="body" required maxlength="4000">${esc(n.body)}</textarea></label><div class="fields"><label>Tanggal publish<input type="date" name="starts" value="${esc(n.starts)}"></label><label>Tanggal selesai<input type="date" name="ends" value="${esc(n.ends)}"></label><label>Tujuan peran<select name="target_role"><option value="">General</option>${options(roles,n.target_role)}</select></label><label>Tujuan area<select name="target_area"><option value="">General</option>${options(['Proses','Sterilizer - Aseptic Tank','Filling','Packing','Filling - Packing','InProses'],n.target_area)}</select></label></div><label class="inlinecheck"><input name="active" type="checkbox" ${n.active!==false?'checked':''}>Tampilkan di dashboard</label><button class="primary">Simpan pengumuman</button></form>`;el.scrollIntoView();const f=el.querySelector('form');f.onsubmit=busy(f.querySelector('button'),async()=>{const v=data(f);await api('notice_save',{...v,id:n.id||crypto.randomUUID(),active:!!v.active});toast('Pengumuman tersimpan.');await go('management',{},true);});}
 onBtn(notes,'[data-note]',b=>note(notices.find(n=>n.id===b.dataset.note)));onBtn(host,'#notice',()=>note({}));users();
}
function settings(host){
 const en=language()==='en', label=(id,eng)=>en?eng:id;
 host.innerHTML=heading(label('Pengaturan','Settings'),'',label('Personalisasi','Preferences'))+
 `<section class="panel stack"><h3>${label('Tampilan perangkat','Device display')}</h3><label>${label('Bahasa navigasi dan format angka/tanggal','Navigation language and number/date format')}<select id="navLanguage">${Object.entries({id:'Bahasa Indonesia',en:'English',ja:'日本語',ko:'한국어',zh:'中文'}).map(([key,value])=>'<option value="'+key+'" '+(key===language()?'selected':'')+'>'+value+'</option>').join('')}</select></label><small>${label('Formulir produksi dan materi menggunakan bahasa dokumen. Zona waktu produksi adalah WIB.','Forms and learning materials use their source language. Production times are in WIB.')}</small><label class="inlinecheck"><input id="dark" type="checkbox" ${localStorage.getItem('satu-theme')==='dark'?'checked':''}>${label('Tema gelap','Dark theme')}</label><label class="inlinecheck"><input id="dense" type="checkbox" ${localStorage.getItem('satu-density')==='dense'?'checked':''}>${label('Tabel ringkas','Compact tables')}</label></section>
 <form class="panel stack"><h3>${label('Ubah kata sandi','Change password')}</h3><div class="fields"><label>${label('Kata sandi saat ini','Current password')}<input name="current" type="password" required autocomplete="current-password"></label><label>${label('Kata sandi baru','New password')}<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></div><button class="primary">${label('Simpan kata sandi','Save password')}</button></form>`;
 host.querySelector('#navLanguage').onchange=e=>{localStorage.setItem('satu-nav-language',e.target.value);drawNavigation();go('settings',{},true);};
 host.querySelector('#dark').onchange=e=>{localStorage.setItem('satu-theme',e.target.checked?'dark':'light');applyPrefs();};host.querySelector('#dense').onchange=e=>{localStorage.setItem('satu-density',e.target.checked?'dense':'normal');applyPrefs();};
 const f=host.querySelector('form');f.onsubmit=busy(f.querySelector('button'),async()=>{await api('password',data(f));signedOut();toast('Kata sandi diperbarui. Silakan masuk kembali.');});
}
export async function render(key,host,args){if(key==='education')return education(host,args);if(key==='ask'){const {ask}=await import('/ai.js');if(host.isConnected)return ask(host);return;}if(key==='management')return management(host);return settings(host);}


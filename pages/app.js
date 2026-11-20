import {watchDashboard} from '/live.js';
const $=s=>document.querySelector(s);
const app={person:null,line:'',clock:null,catalog:[],route:'dashboard',isDirty:null,cleanup:null,vision:false};
const navigation = {
 id: {dashboard:'Dashboard', reports:'Laporan produksi', trace:'Penelusuran data', education:'Pusat belajar', ask:'AI Corner', management:'Area manajemen', settings:'Pengaturan'},
 en: {dashboard:'Dashboard', reports:'Production reports', trace:'Trace records', education:'Education Corner', ask:'AI Corner', management:'Management area', settings:'Settings'}
};
const language=()=>localStorage.getItem('satu-nav-language')==='en'?'en':'id';
const locale=()=>language()==='en'?'en-GB':'id-ID';
const icons={dashboard:'▦',reports:'▤',trace:'⌕',education:'▧',ask:'✧',management:'▣',settings:'⚙'};
const statusNames={DRAFT:'Draf',PENDING:'Menunggu persetujuan',APPROVED:'Disetujui',REVISION:'Perlu revisi',ARCHIVED:'Diarsipkan'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat(locale()).format(Number(v)||0);
const dateLabel=(d,short=false)=>d?new Intl.DateTimeFormat(locale(),{day:'numeric',month:short?'short':'long',...(short?{}:{year:'numeric'}),timeZone:'Asia/Jakarta'}).format(new Date(d+'T12:00:00+07:00')):'—';
const offset=(d,days)=>new Date(Date.parse(d+'T12:00Z')+86400000*days).toISOString().slice(0,10);
const tag=s=>'<span class="tag '+esc(s)+'">'+esc(statusNames[s]||s)+'</span>';
const titleOf=id=>app.catalog.find(x=>x.id===id)?.title||id;
function toast(msg,bad=false){const x=$('#flash');x.textContent=msg;x.hidden=false;x.classList.toggle('bad',bad);clearTimeout(toast.timer);toast.timer=setTimeout(()=>x.hidden=true,bad?9500:4800);}
async function api(name,data={}){
 const isWrite=['save','submit','return','approve','archive'].includes(name);
 if(isWrite)app.writePending=(app.writePending||0)+1;
 let r;try{r=await fetch('/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(app.person && name!=='login' ? {...data,line:app.line} : data),credentials:'same-origin'});}catch{throw Error('Jaringan terputus. Isian tersedia selama formulir tetap terbuka.');}finally{if(isWrite)app.writePending--;}
 let x;
 try { x=await r.json(); } catch { throw Error('Respons API Cloudflare tidak terbaca. Periksa koneksi dan konfigurasi deployment.'); }
 if(!r.ok){if(r.status===401 && name!=='login' && app.person){rememberDraft();signedOut();}const e=Error(x.error||'Permintaan gagal.');e.status=r.status;throw e;}return x;
}
function heading(title,sub='',eyebrow='Operasional',action=''){return `<div class="heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${sub?' <p class="muted">'+esc(sub)+'</p>':''}</div>${action}</div>`;}
function busy(el,fn){return async e=>{e?.preventDefault();if(el.disabled)return;el.disabled=true;try{await fn(e);}catch(err){toast(err.message,true);}finally{el.disabled=false;}};}
function onBtn(root,selector,fn){root.querySelectorAll(selector).forEach(el=>el.addEventListener('click',busy(el,()=>fn(el))));}
function signedOut(){++epoch;for(const d of document.querySelectorAll('dialog[open]'))d.close('cancel');app.cleanup?.();app.cleanup=null;app.isDirty=null;app.captureDraft=null;app.person=null;app.catalog=[];app.line='';$('#shell').hidden=true;$('#login').hidden=false;$('#main').replaceChildren();$('#printRoot').replaceChildren();$('#loginForm').reset();$('#loginForm').elements.password.type='password';$('#showPass').textContent='Lihat';$('#shell').classList.remove('mobile-open');$('#loginStatus').hidden=true;document.title='SATU ULTRAJAYA · Masuk';}
function adminArea(){return ['admin','management'].includes(app.person?.role);}
function approvalOnly(){return ['pengawas','foreman'].includes(app.person?.role);}
function mayReview(){return approvalOnly()||adminArea();}
function roleName(role){return ({admin:'Admin',operator:'Operator',pengawas:'Pengawas',foreman:'Foreman',qc:'QC',qa:'QA',ci:'CI',management:'Manajemen'})[role]||role;}
function applyPrefs(){document.documentElement.classList.toggle('dark',localStorage.getItem('satu-theme')==='dark');document.documentElement.classList.toggle('dense',localStorage.getItem('satu-density')==='dense');}
function menuState(){const mobile=matchMedia('(max-width:720px)').matches;$('#menu').setAttribute('aria-expanded',String(mobile?$('#shell').classList.contains('mobile-open'):!$('#shell').classList.contains('collapsed')));}
async function enter(session){
 Object.assign(app,session);app.catalog=await api('catalog');$('#login').hidden=true;$('#shell').hidden=false;
 const lineHost=$('#line');
 lineHost.textContent=app.line;
 const lines=app.person.productionLines||[];
 if(lines.length>1){
  const select=document.createElement('select');
  select.setAttribute('aria-label','Line produksi aktif');
  for (const line of lines) select.add(new Option(line,line,false,line===app.line));
  select.onchange=async()=>{
   const next=select.value;
   select.disabled=true;
   try{
    if(!await canLeave())return;
    if(app.writePending){toast('Tunggu proses simpan selesai.');return;}
    app.line=next;
    if(!await restoreDraft())await go('dashboard',{},true);
   }finally{select.value=app.line;select.disabled=false;}
  };
  lineHost.replaceChildren(select);
 }
 $('#personName').textContent=app.person.name;$('#personRole').textContent=[roleName(app.person.role),app.person.workArea].filter(Boolean).join(' · ');$('#monogram').textContent=app.person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 drawNavigation();menuState();if(!await restoreDraft())await go('dashboard',{},true);
}
function drawNavigation(){
 const lang=language(),names=navigation[lang],isEn=lang==='en';
 const nav=$('#nav');
 nav.lang=lang;
 nav.innerHTML=Object.keys(names).filter(k=>k!=='management'||adminArea()).map(k=>`<button class="navbtn" data-go="${k}"><span class="glyph" aria-hidden="true">${icons[k]}</span>${names[k]}</button>`).join('');
 onBtn(nav,'[data-go]',b=>go(b.dataset.go));
 $('.nav-caption').textContent=isEn?'Workspace':'Ruang kerja';
 $('#logout').textContent=isEn?'Sign out':'Keluar dari akun';
 $('#menu').setAttribute('aria-label',isEn?'Toggle navigation':'Buka atau tutup navigasi');
 nav.setAttribute('aria-label',isEn?'Application navigation':'Navigasi aplikasi');
}
// A draft survives session expiry only inside this tab. Never write production data to web storage.
let temporaryDraft=null;
function rememberDraft(){
 const args=app.captureDraft?.();
 if(args&&app.person)temporaryDraft={person:app.person.id,line:app.line,args};
}
async function restoreDraft(){
 if(!temporaryDraft)return false;
 if(temporaryDraft.person!==app.person?.id){temporaryDraft=null;return false;}
 if(temporaryDraft.line!==app.line){if(!app.person.productionLines?.includes(temporaryDraft.line))temporaryDraft=null;return false;}
 const {args}=temporaryDraft;
 await go('edit',args,true);
 return true;
}
function releaseTemporaryDraft(){temporaryDraft=null;}
let epoch=0;
function askDialog(title,action='Lanjutkan',withNote=false){
 const dlg=document.createElement('dialog');dlg.className='appdialog';dlg.setAttribute('aria-labelledby','dialogTitle');
 dlg.innerHTML='<form method="dialog" class="stack"><h3 id="dialogTitle">'+esc(title)+'</h3>'+(withNote?'<label>Alasan<textarea name="note" maxlength="800" rows="3" required></textarea></label>':'')+'<div class="actions"><button class="outline" type="button">Batal</button><button class="primary" value="ok">'+esc(action)+'</button></div></form>';
 document.body.appendChild(dlg);dlg.querySelector('[type=button]').onclick=()=>dlg.close('cancel');dlg.showModal();
 return new Promise(resolve=>dlg.addEventListener('close',()=>{const value=dlg.returnValue==='ok'?(withNote?dlg.querySelector('textarea').value.trim():true):false;dlg.remove();resolve(value);},{once:true}));
}
async function canLeave(){return !app.isDirty?.()||await askDialog('Tinggalkan perubahan yang belum disimpan?','Tinggalkan');}
async function go(key,args={},force=false){
 if(!app.person||(!force&&!await canLeave()))return;
 app.cleanup?.();app.cleanup=null;app.isDirty=null;app.captureDraft=null;app.route=key;const e=++epoch;$('#shell').classList.remove('mobile-open');menuState();
 const names=navigation[language()],actual=['edit','downtime'].includes(key)?'reports':key==='detail'?'trace':key;$('#breadcrumb').textContent=names[actual];
 document.title=(names[actual]||'Laporan')+' · SATU ULTRAJAYA';$('#nav').querySelectorAll('[data-go]').forEach(b=>b.setAttribute('aria-current',b.dataset.go===actual?'page':'false'));
 const host=document.createElement('section');$('#main').replaceChildren(host);host.innerHTML='<p class="muted">Memuat…</p>';$('#main').focus({preventScroll:true});window.scrollTo(0,0);
 try{if(key==='dashboard')await dashboard(host);
 else if(['reports','edit','trace','detail','downtime'].includes(key)){const m=await import('/report.js');if(e===epoch)await m.render(key,host,args);}
 else{const m=await import('/support.js');if(e===epoch)await m.render(key,host,args);}
 }catch(err){if(!host.isConnected)return;host.innerHTML='<p class="message bad">'+esc(err.message)+'</p><button class="outline">Coba lagi</button>';onBtn(host,'button',()=>go(key,args,true));}
}
async function dashboard(host){
 const now=await api('clock');if(!host.isConnected)return;app.clock=now;const end=now.calendar;
 const serverOffset=Date.parse(now.stamp)-Date.now();let rolling=true,noticeTime=0,noticeCache=[];
 const canWrite=app.catalog.some(f=>f.id!=='SUPERVISOR_DAILY'||adminArea())&&!approvalOnly();
 const action=canWrite?'<button class="primary" id="newRpt">+ Buat laporan</button>':approvalOnly()&&app.catalog.length?'<button class="primary" id="reviewQueue">Tinjau laporan</button>':'';
 host.innerHTML=heading('Dashboard produksi','Perolehan dan kejadian dari laporan yang telah disetujui.','Ringkasan line',action)+
 `<form class="toolbar"><label>Dari tanggal<input name="from" type="date" value="${offset(end,-6)}" required></label><label>Sampai tanggal<input name="to" type="date" value="${end}" required></label><button class="outline">Tampilkan</button></form><div class="results"></div>`;
 onBtn(host,'#newRpt',()=>go('reports'));const form=host.querySelector('form'),results=host.querySelector('.results');let pending=false,queued=false,live=false;let filters=Object.fromEntries(new FormData(form));
 onBtn(host,'#reviewQueue',()=>go('trace',{...filters,status:'PENDING'}));
 async function update(){
  if(!host.isConnected)return;
  if(pending){queued=true;return;}
  pending=true;
  if(rolling){
   const today=new Date(Date.now()+serverOffset+7*3600000).toISOString().slice(0,10);
   if(today!==filters.to){
    const editing=form.elements.to.value!==filters.to || form.elements.from.value!==filters.from;
    filters={from:offset(today,-6),to:today};
    if(!editing){form.elements.from.value=filters.from;form.elements.to.value=today;}
   }
  }
  const range=filters;
  try{const reloadNotices=Date.now()-noticeTime>300000;
   const [d,notices]=await Promise.all([api('dashboard',range),reloadNotices?api('notices'):noticeCache]);
   if(!host.isConnected)return;
   if(reloadNotices){noticeCache=notices;noticeTime=Date.now();}
   if(range!==filters)return;
   const card=(label,value,unit,detail)=>`<section class="card"><p class="kicker">${label}</p><strong>${fmt(value)} <small>${unit}</small></strong><small>${esc(detail)}</small></section>`;
   const bars=(rows,day)=>{if(!rows.length)return '<p class="empty">Belum ada data disetujui pada periode ini.</p>';const val=r=>Number(day?r.good:r.n),max=Math.max(1,...rows.map(val));return '<div class="barlist">'+rows.map(x=>`<div class="barrow"><span>${esc(day?dateLabel(x.day,true):x.key)}</span><div class="track"><i style="width:${100*val(x)/max}%"></i></div><strong>${fmt(val(x))}</strong></div>`).join('')+'</div>';};
   const hasTotal=app.catalog.some(form=>form.id==='PRODUCTION_TOTAL'),hasEvent=app.catalog.some(form=>form.id==='FILL_EVENT');
   const cards=[
    ...(hasTotal?[card('Perolehan aktual',d.actual,'pak',d.target?fmt(Math.round(100*d.actual/d.target))+'% dari target':'Target belum tercatat'),card('Produk baik',d.good,'pak',fmt(d.reject)+' pak reject')]:[]),
    ...(hasEvent?[card('Planned downtime',d.planned,'menit','Event terencana'),card('Unplanned downtime',d.unplanned,'menit','Termasuk short stop')]:[])
   ];
   const charts=[
    ...(hasTotal?['<section class="panel"><h3>Produk baik per hari</h3>'+bars(d.days,true)+'</section>']:[]),
    ...(hasEvent?['<section class="panel"><h3>Top Quality Issue</h3>'+bars(d.issues,false)+'</section>']:[])
   ];
   results.innerHTML=`${cards.length?'<div class="grid kpis">'+cards.join('')+'</div>':''}${charts.length?'<div class="columns">'+charts.join('')+'</div>':''}<section class="panel"><div class="spread"><div><h3>Persetujuan laporan</h3><p>${fmt(d.pending)} menunggu persetujuan dari ${fmt(d.reports)} laporan periode ini.</p></div><button class="outline" id="queue">Lihat antrean →</button></div></section><section class="panel"><h3>Pengumuman</h3>${notices.filter(x=>x.active).slice(0,4).map(x=>'<div class="book"><div><strong>'+esc(x.title)+'</strong><p class="note">'+esc(x.body)+'</p></div></div>').join('')||'<p class="muted">Belum ada pengumuman aktif.</p>'}</section><p><small><span class="live-state">${live?'Live antarperangkat':'Penyegaran berkala 60 detik'}</span> · Diperbarui ${esc(new Date(Date.now()+serverOffset).toLocaleTimeString(locale(),{timeZone:'Asia/Jakarta'}))} WIB</small></p>`;
   onBtn(results,'#queue',()=>go('trace',{status:'PENDING',from:range.from,to:range.to}));
  }finally{pending=false;if(queued&&host.isConnected){queued=false;await update();}}
 }
 form.addEventListener('submit',busy(form.querySelector('button'),async()=>{rolling=false;filters=Object.fromEntries(new FormData(form));await update();}));await update();if(!host.isConnected)return;
 const refresh=()=>update().catch(e=>{
  if(!host.isConnected)return;
  const label=host.querySelector('.live-state');
  if(label)label.textContent='Pembaruan data tertunda';
  toast(e.message,true);
 });
 const stop=watchDashboard(api,refresh,connected=>{live=connected;const label=host.querySelector('.live-state');if(label)label.textContent=live?'Live antarperangkat':'Penyegaran berkala 60 detik';});
 const t=setInterval(()=>{if(!document.hidden)refresh();},60000);app.cleanup=()=>{clearInterval(t);stop();};
}
export {app,api,go,esc,fmt,dateLabel,offset,tag,titleOf,heading,onBtn,busy,toast,adminArea,mayReview,approvalOnly,roleName,statusNames,applyPrefs,signedOut,askDialog,language,locale,drawNavigation,releaseTemporaryDraft};
applyPrefs();
$('#showPass').onclick=()=>{const p=$('#loginForm').elements.password;p.type=p.type==='password'?'text':'password';$('#showPass').textContent=p.type==='password'?'Lihat':'Sembunyi';};
$('#menu').onclick=()=>{const cls=matchMedia('(max-width:720px)').matches?'mobile-open':'collapsed';$('#shell').classList.toggle(cls);menuState();};
$('#logout').onclick=busy($('#logout'),async()=>{if(!await canLeave())return;await api('logout');releaseTemporaryDraft();signedOut();});
window.addEventListener('beforeunload',e=>{if(app.isDirty?.()){e.preventDefault();e.returnValue='';}});
$('#loginForm').onsubmit=async e=>{e.preventDefault();const b=$('#enter'),m=$('#loginStatus'),form=e.currentTarget;if(b.disabled)return;b.disabled=true;m.hidden=false;m.className='message';m.textContent='Memeriksa lokasi perangkat…';
 try{if(!navigator.geolocation)throw Error('Lokasi belum tersedia. Gunakan browser yang mendukung lokasi melalui HTTPS.');
  const g=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,err=>reject(Error(err.code===1?'Izin lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser.':'Lokasi belum terbaca. Aktifkan lokasi presisi dan coba kembali.')),{enableHighAccuracy:true,timeout:18000,maximumAge:0}));
  m.textContent='Memeriksa akun…';const session=await api('login',{employee:form.elements.employee.value,password:form.elements.password.value,geo:{lat:g.coords.latitude,lon:g.coords.longitude,accuracy:g.coords.accuracy}});
  form.reset();await enter(session);m.hidden=true;
 }catch(err){m.textContent=err.message;m.className='message bad';}finally{b.disabled=false;}};
api('me').then(enter).catch(e=>{signedOut();if(e.status!==401){$('#loginStatus').hidden=false;$('#loginStatus').textContent=e.message;}});


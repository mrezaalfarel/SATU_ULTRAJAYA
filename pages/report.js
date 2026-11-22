import {hours,hourLabel,volumeMatrix} from '/volume.js';
import {exportFilteredReports} from '/export.js';
import {availableSections,app,api,go,esc,fmt,dateLabel,offset,tag,titleOf,heading,onBtn,busy,toast,mayReview,approvalOnly,adminArea,statusNames,askDialog,locale,releaseTemporaryDraft} from '/app.js';
const opt=(v,label,selected)=>'<option value="'+esc(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+esc(label)+'</option>';
function picker(host,args){
 const areas=availableSections(),forms=areas[args.area];
 if(!forms){
  host.innerHTML=heading('Laporan produksi','Pilih area kerja untuk melihat laporan yang tersedia.')+
   '<div class="portal-grid">'+Object.keys(areas).map(area=>`<button class="portal-card" data-section="${esc(area)}"><strong>${esc(area)}</strong><small>${areas[area].length} laporan →</small></button>`).join('')+'</div>';
  if(!Object.keys(areas).length)host.insertAdjacentHTML('beforeend','<p class="empty">Hubungi admin untuk mendapatkan penugasan area dan line.</p>');
  onBtn(host,'[data-section]',b=>go('reports',{area:b.dataset.section}));return;
 }
 const filling=args.area==='Filling Machine';
 const fillingNames={FILL_PRODUCTION:['▤','Laporan Filling'],FILL_EVENT:['◷','Laporan Event'],FILL_PACK:['◇','Pack Integrity'],FILL_VOLUME:['▥','Volume Control'],FILL_CIP:['◈','Internal CIP Filling']};
 host.innerHTML=heading(args.area,app.line,'Laporan produksi','<button class="outline" id="allAreas">Semua area</button>')+
  '<div class="portal-grid '+(filling?'filling-grid':'')+'">'+forms.map(d=>`<button class="portal-card" ${d.id==='downtime'?'data-summary':approvalOnly()?'data-browse':'data-new'}="${esc(d.id)}">${filling?'<i aria-hidden="true">'+fillingNames[d.id][0]+'</i>':''}<small>${esc(d.formNo||'Rekap shift')}</small><strong>${esc(filling?fillingNames[d.id][1]:d.title)}</strong><span>${d.id==='downtime'?'Lihat rekap':approvalOnly()?'Tinjau laporan':'Buka formulir'} →</span></button>`).join('')+'</div>';
 onBtn(host,'#allAreas',()=>go('reports'));
 onBtn(host,'[data-summary]',()=>go('downtime'));
 onBtn(host,'[data-new]',b=>go('edit',{type:b.dataset.new,area:args.area}));
 onBtn(host,'[data-browse]',b=>go('trace',{type:b.dataset.browse,status:'PENDING'}));
}
async function downtime(host,args){
 const {calendar}=await api('clock');
 if(!host.isConnected)return;
 host.innerHTML=heading('Laporan Downtime','Setiap durasi berasal dari Laporan Kejadian Produksi yang sudah disetujui.','Laporan produksi',approvalOnly()?'':'<button class="primary" id="fromEvent">+ Catat kejadian</button>')+
 `<form class="toolbar"><label>Dari tanggal<input name="from" type="date" value="${esc(args.from||offset(calendar,-6))}" required></label><label>Sampai tanggal<input name="to" type="date" value="${esc(args.to||calendar)}" required></label><button class="outline">Tampilkan</button></form><div id="downtimeRows" aria-live="polite"></div>`;
 const form=host.querySelector('form'),out=host.querySelector('#downtimeRows');
 let filters,rows=[],totals,nextPage=false,sequence=0;
 onBtn(host,'#fromEvent',()=>go('edit',{type:'FILL_EVENT'}));
 async function load(reset){
  const seq=++sequence,range=reset?Object.fromEntries(new FormData(form)):filters;
  const cursor=reset?{}:{cursor_day:rows.at(-1).day,cursor_id:rows.at(-1).id};
  const [list,summary]=await Promise.all([api('downtime',{...range,...cursor}),reset?api('dashboard',range):totals]);
  if(seq!==sequence||!host.isConnected)return;
  filters=range;totals=summary;nextPage=list.length>25;
  rows=(reset?[]:rows).concat(list.slice(0,25));
  const kpi=(label,value)=>`<section class="card"><p class="kicker">${label}</p><strong>${fmt(value)} <small>menit</small></strong></section>`;
  out.innerHTML=`<div class="grid kpis">${kpi('Planned downtime',totals.planned)}${kpi('Unplanned downtime termasuk short stop',totals.unplanned)}</div><section class="panel"><div class="spread"><h3>Laporan per mesin dan shift</h3><button class="outline" id="sourceEvents">Telusuri laporan sumber</button></div>`+
   (rows.length?'<div class="tablewrap"><table><thead><tr><th>Tanggal</th><th>Mesin</th><th>Shift</th><th>Planned (menit)</th><th>Unplanned (menit)</th><th></th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${esc(dateLabel(r.day))}</td><td>${esc(r.unit)}</td><td>${esc(r.shift)}</td><td>${fmt(r.planned)}</td><td>${fmt(r.unplanned)}</td><td><button class="text-btn" data-open="${esc(r.id)}">Buka laporan</button></td></tr>`).join('')+'</tbody></table></div>':'<p class="empty">Belum ada laporan kejadian yang disetujui pada periode ini.</p>')+
   (nextPage?'<button class="outline" id="nextDowntime">Muat 25 berikutnya</button>':'')+'</section>';
  onBtn(out,'#sourceEvents',()=>go('trace',{...filters,type:'FILL_EVENT',status:'APPROVED'}));
  onBtn(out,'[data-open]',b=>go('detail',{id:b.dataset.open}));
  onBtn(out,'#nextDowntime',()=>load(false));
 }
 form.onsubmit=busy(form.querySelector('button'),()=>load(true));
 await load(true);
}
async function trace(host,args){
 const day=(await api('clock')).calendar;
 host.innerHTML=heading('Tracing Data','Telusuri laporan dengan tanggal atau identitas persis pada label produk dan material.','Penelusuran')+
 `<form class="panel"><div class="fields"><label>Batch, lot, SKU, reel, produk, atau unit<input name="q" maxlength="150" value="${esc(args.q)}"></label><label>Jenis laporan<select name="type">${opt('','Semua jenis',args.type)}${app.catalog.map(d=>opt(d.id,d.title,args.type)).join('')}</select></label><label>Status<select name="status">${opt('','Semua status',args.status)}${Object.entries(statusNames).filter(([k])=>k!=='ARCHIVED'||app.person.role==='admin').map(([k,v])=>opt(k,v,args.status)).join('')}</select></label><label>Dari<input type="date" name="from" value="${esc(args.from||offset(day,-30))}" required></label><label>Sampai<input type="date" name="to" value="${esc(args.to||day)}" required></label></div><div class="actions"><button class="primary">Cari laporan</button></div></form><div class="panel" id="matches"></div>`;
 const form=host.querySelector('form'),out=host.querySelector('#matches');let filters,cursor=null,rows=[],sequence=0;
 async function search(reset){
  const request=++sequence,newFilters=reset?Object.fromEntries(new FormData(form)):filters;
  const src=await api('list',{...newFilters,...(reset?{}:cursor)});
  if(request!==sequence||!host.isConnected)return;
  if(reset){filters=newFilters;rows=[];}
  rows.push(...src.slice(0,25));const last=rows.at(-1);
  cursor=src.length>25?{cursor_day:last.day,cursor_id:last.id}:null;
  out.innerHTML='<div class="spread"><h3>Hasil penelusuran</h3>'+(rows.length?'<button class="outline" id="csv">Ekspor hasil pencarian (CSV)</button>':'')+'</div>'+
  (rows.length?'<div class="tablewrap"><table><thead><tr><th>Tanggal / shift</th><th>Formulir / unit</th><th>SKU / batch / lot</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${esc(dateLabel(r.day,true))}<br><small>Shift ${r.shift}</small></td><td>${esc(titleOf(r.type))}<br><small>${esc(r.unit)}${r.cook?' · Masakan '+r.cook:''}</small></td><td>${esc([r.sku,r.batch,r.lot].filter(Boolean).join(' / ')||'—')}</td><td>${tag(r.status)}</td><td><button class="text-btn" data-open="${r.id}">Buka</button></td></tr>`).join('')+'</tbody></table></div>':'<p class="empty">Belum ada laporan yang sesuai dengan filter ini.</p>')+
  (cursor?'<div class="actions"><button class="outline" id="next">Muat 25 berikutnya</button></div>':'');
  onBtn(out,'[data-open]',b=>go('detail',{id:b.dataset.open}));onBtn(out,'#next',()=>search(false));onBtn(out,'#csv',async button=>{
   const session=app.person?.id, line=app.line, run=sequence;
   try {
    const count=await exportFilteredReports({filters,api,catalog:app.catalog,
     active:()=>host.isConnected && run===sequence && app.line===line && app.person?.id===session,
     progress:n=>{button.textContent='Mengekspor '+fmt(n)+' laporan…';}});
    toast(fmt(count)+' laporan diekspor.');
   } catch(error){if(error.name!=='AbortError')throw error;}
   finally{button.textContent='Ekspor hasil pencarian (CSV)';}
  });
 }
 form.onsubmit=busy(form.querySelector('button'),()=>search(true));await search(true);
}
function entry(f,value,attrs,ro=false){
 const disable=ro||f.computed, extra=attrs+(disable?' disabled':'');const v=value??'';
 let el;
 if(['select','check'].includes(f.type)){
  const options=(f.options||[]).filter(x=>x!=='');el='<select '+extra+'>'+opt('','Pilih…',v)+options.map(x=>opt(x,f.labels?.[x]?x+' · '+f.labels[x]:x,v)).join('')+'</select>';
 }else if(f.type==='textarea')el=`<textarea rows="3" maxlength="2000" ${extra}>${esc(v)}</textarea>`;
 else{const numeric=['number','integer'].includes(f.type);el=`<input type="${numeric?'text':['date','time'].includes(f.type)?f.type:'text'}" ${numeric?'inputmode="decimal"':''} maxlength="200" ${extra} value="${esc(v)}">`;}
 const outside=f.type==='number'&&v!==''&&((f.lower!==undefined&&f.lower!==''&&Number(v)<Number(f.lower))||(f.upper!==undefined&&f.upper!==''&&Number(v)>Number(f.upper)));
 return `<label>${esc(f.label)}${f.required?' *':''}${f.unit?' ('+esc(f.unit)+')':''}${el}${f.hint?'<small>'+esc(f.hint)+'</small>':''}${outside?'<small class="danger">Di luar batas referensi pada formulir</small>':''}</label>`;
}
function times(a,b){if(!a||!b)return '';const m=x=>+x.slice(0,2)*60+ +x.slice(3);return String((m(b)-m(a)+1440)%1440);}
async function edit(host,args){
 const resumed=args.recovery;
 let r=args.id?await api('detail',{id:args.id}):null;const clock=await api('clock');
 if(!host.isConnected)return;
 const def=app.catalog.find(x=>x.id===(r?.type||args.type));if(!def)throw Error('Formulir tidak ditemukan.');
 const fill=def.id.startsWith('FILL_'),calendarForm=fill||['ASEPTIC_GEA','STERILIZER_GEA'].includes(def.id);
 const record=r||{id:resumed?.id||crypto.randomUUID(),type:def.id,cook:def.id==='PROCESS_MILK'?1:0,version:0,status:'DRAFT',doc:{meta:{date:calendarForm?clock.calendar:clock.day,shift:fill?clock.fillShift:clock.shift,...Object.fromEntries(def.meta.filter(f=>['operator','operator_general'].includes(f.key)).map(f=>[f.key,app.person.name]))},sections:{}}};
 if(fill&&!r&&!resumed){
  const machine=app.line.match(/^(?:fm|filling(?: machine)?)[ _-]*0*(\d+)$/i);
  if(machine)record.doc.meta.unit=machine[1];
 }
 const mayWrite=!approvalOnly()&&(def.id!=='SUPERVISOR_DAILY'||adminArea());
 if(!r&&!mayWrite)throw Error('Akun ini dapat meninjau laporan yang dikirim untuk persetujuan.');
 const doc=structuredClone(resumed?.doc||record.doc);const editable=mayWrite&&['DRAFT','REVISION'].includes(record.status)&&(!r||r.owner_id===app.person.id||mayReview());
 if(resumed&&!r)record.cook=resumed.cook;
 const version=resumed?.version??record.version;
 let dirty=Boolean(resumed),op=resumed?.op||null,inFlight=false,server=clock,correction=resumed?.note||'';const slots={};const opened=new Set(['meta']);if(!r)opened.add(def.sections[0].id);
 const historyLabels={save:'Simpan',submit:'Kirim untuk persetujuan',approve:'Setujui',return:'Kembalikan',archive:'Arsipkan'};
 app.isDirty=()=>dirty||inFlight;
 app.captureDraft=()=>dirty?{type:def.id,id:r?.id,recovery:{id:record.id,doc:structuredClone(doc),cook:record.cook,op,version,note:correction}}:null;
 if(resumed){releaseTemporaryDraft();toast(version===record.version?'Isian sebelum sesi berakhir dipulihkan. Periksa lalu simpan draf.':'Isian dipulihkan. Versi server telah berubah. Periksa laporan terbaru sebelum menyimpan.',true);}
 let selectedJaw=1,activeSection=def.sections[0].id;
 const getSlot=g=>slots[g.id]||=(g.kind==='hourly'?(doc.sections[g.id]?.[server.hour]||!r?server.hour:Object.keys(doc.sections[g.id]||{})[0]||server.hour):'1');
 function redraw(){
  const tabLabels={CIP_SUMMARY:'CIP Ringkas',MACHINE_CHECK:'Cek Persiapan',maintenance:'Perawatan',hour:'Periksa Tiap Jam',paper:'Paper',strip:'Strip',foreman:'Kontrol SPV'};
  const md=def.meta.map(f=>entry(f,doc.meta[f.key],`data-meta="${f.key}"`,!editable||(!!r&&(['date','unit','shift'].includes(f.key)||(['STERILIZER_GEA','ASEPTIC_GEA','ASEPTIC_CIP'].includes(def.id)&&['stlz','at','operator','supervisor'].includes(f.key)))))).join('');
  host.innerHTML=heading(def.title,def.formNo+(def.rev?' · Rev '+def.rev:'')+' · '+app.line,'Report Production','<button class="outline" id="back">Ke daftar laporan</button>')+
  `<div class="modebar spread">${tag(record.status)}<small>${record.version?'Versi '+record.version:'Laporan baru'} · Waktu server ${esc(server.hm)} WIB</small></div>${record.review_note?'<p class="message">Catatan pengawas · '+esc(record.review_note)+'</p>':''}<details class="group" data-group="meta" ${opened.has('meta')?'open':''}><summary>Identitas laporan</summary><div class="inner fields">${md}${def.id==='PROCESS_MILK'?'<label>Masakan<select id="cook" '+(r||!editable?'disabled':'')+'>'+[1,2,3,4].map(x=>opt(x,'Masakan '+x,record.cook)).join('')+'</select></label>':''}</div></details>`+
  (fill?'<nav class="filling-tabs" aria-label="Bagian laporan">'+def.sections.map(g=>'<button type="button" data-part="'+esc(g.id)+'">'+esc((def.id==='FILL_PRODUCTION'&&tabLabels[g.id])||g.title)+'</button>').join('')+'</nav><div class="actions"><button class="outline" id="livePreview">Pratinjau isian</button><button class="outline" id="reportHistory">Riwayat laporan</button></div>':'')+
  def.sections.map(g=>`<details class="group" data-group="${g.id}" ${opened.has(g.id)?'open':''}><summary>${esc(g.title)} <small>· ${Object.keys(doc.sections[g.id]||{}).length} isian</small></summary><div class="inner"></div></details>`).join('')+
  (r?`<details class="group"><summary>Riwayat perubahan</summary><div class="inner">${(r.history||[]).map(h=>'<p><strong>v'+h.version+' · '+esc(historyLabels[h.action]||h.action)+'</strong> · '+esc(h.name)+' · '+esc(new Date(h.at).toLocaleString(locale(),{timeZone:'Asia/Jakarta'}))+' WIB '+esc(h.note)+'</p>').join('')}</div></details>`:'')+
  `<div class="formfooter"><div class="actions"><span class="mr" id="saveState" role="status">${dirty?'Perubahan belum disimpan':record.version?'Data tersimpan':'Draf baru'}</span>${editable?'<button id="save" class="primary">Simpan draf</button>':''}${editable&&r?'<button class="outline" data-act="submit">Kirim untuk persetujuan</button>':''}${editable&&r&&(app.person.role==='admin'||r.owner_id===app.person.id)?'<button class="dangerbtn" data-act="archive">Arsipkan</button>':''}${r?.can_review?'<button class="primary" data-act="approve">Setujui</button><button class="outline" data-act="return">Kembalikan</button>':''}${r?'<button class="outline" id="print">Cetak / PDF</button>':''}</div></div>`;
  if(fill){
   const activate=(id)=>{
    activeSection=id;
    for(const button of host.querySelectorAll('[data-part]'))button.setAttribute('aria-pressed',String(button.dataset.part===id));
    for(const part of host.querySelectorAll('[data-group]:not([data-group=meta])')){
     part.hidden=part.dataset.group!==id;part.open=!part.hidden;
    }
   };
   activate(activeSection);
   onBtn(host,'[data-part]',button=>activate(button.dataset.part));
   onBtn(host,'#reportHistory',()=>go('trace',{type:def.id}));
   onBtn(host,'#livePreview',async()=>{
    const {reportTables}=await import('/print.js');
    if(!host.isConnected)return;
    const dialog=document.createElement('dialog');dialog.className='appdialog filling-preview';
    dialog.innerHTML='<form method="dialog"><div class="spread"><h2>'+esc(def.title)+'</h2><button class="outline">Tutup</button></div></form><p>'+esc(def.formNo)+' · '+esc(doc.meta.date)+' · Shift '+esc(doc.meta.shift)+' · '+esc(doc.meta.unit||'')+'</p>'+ (reportTables(doc,def)||'<p>Belum ada isian.</p>');
    host.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
   });
  }
  onBtn(host,'#back',()=>go(r?'trace':'reports',{area:args.area}));onBtn(host,'#save',save);onBtn(host,'[data-act]',b=>action(b.dataset.act));onBtn(host,'#print',async()=>{if(dirty)throw Error('Simpan draf sebelum mencetak.');await (await import('/print.js')).printReport(record,def);});
  host.querySelectorAll('[data-meta]').forEach(el=>el.oninput=()=>{doc.meta[el.dataset.meta]=el.value;mark();});for(const el of host.querySelectorAll('[data-meta="date"],[data-meta="shift"]'))el.onchange=()=>{doc.meta[el.dataset.meta]=el.value;mark();for(const box of host.querySelectorAll('details[data-group][open]')){const g=def.sections.find(s=>s.id===box.dataset.group);if(g?.kind==='hourly')fields(box,g);}};
  const cook=host.querySelector('#cook');if(cook)cook.onchange=()=>{record.cook=+cook.value;mark();};
  host.querySelectorAll('details[data-group]').forEach(box=>{const g=def.sections.find(s=>s.id===box.dataset.group);
   const toggle=()=>{if(box.open){opened.add(box.dataset.group);if(g)fields(box,g);}else opened.delete(box.dataset.group);};box.ontoggle=toggle;if(box.open&&g)fields(box,g);
  });
 }
 function mark(){dirty=true;op=null;const msg=host.querySelector('#saveState');if(msg)msg.textContent='Perubahan belum disimpan';}
 function fields(box,g){
  const key=getSlot(g),rows=doc.sections[g.id]||{},row=rows[key]||{},dest=box.querySelector('.inner');
  const limit=g.kind==='hourly'?24:g.kind==='matrix'?g.count:Math.max(1,...Object.keys(rows).map(Number),Number(key));
  const isHourLocked=g.kind==='hourly'&&(key!==server.hour||!(fill?server.fillShifts:[server.shift]).includes(doc.meta.shift)||doc.meta.date!==(calendarForm?server.calendar:server.day));
  const dailyLocked=g.dailyLock&&Boolean(r?.doc.sections[g.id]?.['1']);const allowCorrection=Boolean(r&&editable&&mayReview());const preheatLocked=g.id==='preheat'&&Number(key)>1&&!g.fields.every(f=>rows[Number(key)-1]?.[f.key]);const blocked=!editable||preheatLocked||dailyLocked||(isHourLocked&&!allowCorrection)||(g.supervisor&&!mayReview());
  const nameSlot=n=>g.kind==='hourly'?('Jam '+String(n%24).padStart(2,'0')+'.00'):g.kind==='matrix'?'Kolom '+n:'Isian '+n;
  dest.innerHTML=(g.kind!=='fields'?`<div class="row setbar"><label>${g.kind==='hourly'?'Jam pemeriksaan':'Posisi isian'}<select class="slot">${Array.from({length:limit},(_,i)=>opt(i+1,nameSlot(i+1)+(rows[i+1]?' · terisi':''),key)).join('')}</select></label>${g.kind==='repeater'&&editable&&(!g.supervisor||mayReview())?'<button class="outline add">+ Tambah isian</button>':''}${g.kind==='repeater'&&editable&&rows[key]&&(!g.supervisor||mayReview())?'<button class="text-btn remove">Hapus isian ini</button>':''}</div>`:'')+
   (preheatLocked?'<p class="hint">Lengkapi semua parameter sesi preheating sebelumnya untuk membuka sesi ini.</p>':'')+(dailyLocked?'<p class="hint">Checklist harian telah dikunci.</p>':'')+(isHourLocked?(allowCorrection?'<label>Alasan koreksi pengawas (untuk riwayat perubahan)<textarea class="correction" maxlength="800" rows="2">'+esc(correction)+'</textarea></label>':'<p class="hint">Riwayat jam ini hanya dapat dibaca.</p>'):'')+'<div class="fields">'+g.fields.map(f=>entry(f,row[f.key],`data-key="${f.key}"`,blocked)).join('')+'</div>';
  if(fill&&g.kind==='hourly'){
   const picker=dest.querySelector('.slot');
   picker.innerHTML=hours.map(hour=>opt(hour,hourLabel(hour)+(rows[hour]?' · terisi':''),key)).join('');
   const jump=document.createElement('button');jump.type='button';jump.className='outline';
   jump.textContent='Ke jam server · '+hourLabel(server.hour);
   jump.onclick=()=>{slots[g.id]=server.hour;fields(box,g);};picker.closest('.setbar').append(jump);
  }
  function drawVolume(){
   dest.querySelector('.volume-matrix').innerHTML=volumeMatrix(doc.sections[g.id]||{},r?.doc.sections[g.id]||{},selectedJaw,key);
  }
  if(def.id==='FILL_VOLUME'){
   dest.insertAdjacentHTML('beforeend','<section class="volume-review"><h3>Pratinjau Volume Control</h3><label>Jaw / Track<select class="matrix-jaw">'+Array.from({length:10},(_,i)=>opt(i+1,'Jaw '+(i+1),selectedJaw)).join('')+'</select></label><p>Positif = Jaw · 0 = tengah · Negatif = Track. × tersimpan, ○ belum disimpan.</p><div class="volume-matrix tablewrap" tabindex="0" role="region" aria-label="Matriks posisi per jam"></div></section>');
   dest.querySelector('.matrix-jaw').onchange=e=>{selectedJaw=Number(e.target.value);drawVolume();};
   drawVolume();
  }
  const reason=dest.querySelector('.correction');if(reason)reason.oninput=()=>{correction=reason.value;mark();};
  const sel=dest.querySelector('.slot');if(sel)sel.onchange=()=>{slots[g.id]=sel.value;fields(box,g);};
  onBtn(dest,'.add',()=>{if(limit>=60)throw Error('Maksimal 60 isian per bagian.');slots[g.id]=String(limit+1);fields(box,g);});
  onBtn(dest,'.remove',async()=>{if(!await askDialog('Hapus isian ini dari draf?','Hapus isian'))return;delete rows[key];slots[g.id]=Object.keys(rows)[0]||'1';mark();fields(box,g);});
  dest.querySelectorAll('[data-key]').forEach(el=>el.oninput=()=>{const rs=doc.sections[g.id]??={};const target=rs[key]??={};
   if(el.value!=='')target[el.dataset.key]=el.value;else delete target[el.dataset.key];
   const result=g.fields.find(f=>f.computed);if(result){const delta=def.id==='FILL_CIP'?times(target.Start,target.Stop):times(target.Stop,target.Start);const comp=dest.querySelector('[data-key="'+result.key+'"]');comp.value=delta;if(delta)target[result.key]=delta;else delete target[result.key];}
   if(!Object.keys(target).length)delete rs[key];
   if(def.id==='FILL_VOLUME'){
    selectedJaw=Number(el.dataset.key.slice(4));dest.querySelector('.matrix-jaw').value=String(selectedJaw);drawVolume();
   }
   mark();
  });
 }
 async function save(){if(inFlight)return;inFlight=true;host.inert=true;try{op||=crypto.randomUUID();const x=await api('save',{id:record.id,type:def.id,version,cook:record.cook,op,doc,note:correction});
  dirty=false;if(!host.isConnected)return;toast('Draf tersimpan · versi '+x.version);await go('detail',{id:record.id},true);
 }finally{inFlight=false;host.inert=false;}}
 const actionOps=new Map();
 async function action(a){if(inFlight)return;if(dirty)throw Error('Simpan perubahan sebelum melanjutkan.');
  let note='';if(['return','archive'].includes(a)){note=await askDialog(a==='return'?'Kembalikan kepada operator?':'Arsipkan laporan ini?',a==='return'?'Kembalikan':'Arsipkan',true);if(note===false)return;if(!note.trim())throw Error('Isi alasan terlebih dahulu.');}
  else if(!await askDialog(a==='approve'?'Setujui dan kunci laporan ini?':'Kirim laporan ini untuk persetujuan?',a==='approve'?'Setujui':'Kirim'))return;
  const k=a+'|'+note;if(!actionOps.has(k))actionOps.set(k,crypto.randomUUID());
  inFlight=true;host.inert=true;try{await api(a,{id:record.id,version:record.version,op:actionOps.get(k),note});if(!host.isConnected)return;toast('Status laporan diperbarui.');await go(a==='archive'?'trace':'detail',{id:record.id},true);}finally{inFlight=false;host.inert=false;}
 }
 redraw();
 const timer=setInterval(async()=>{if(document.hidden||!host.isConnected)return;try{const next=await api('clock');if(server.hour!==next.hour||server.shift!==next.shift||server.day!==next.day||String(server.fillShifts)!==String(next.fillShifts)){server=next;redraw();}else server=next;}catch{}},45000);
 app.cleanup=()=>clearInterval(timer);
}
export async function render(key,host,args){if(key==='reports')return picker(host,args);if(key==='trace')return trace(host,args);if(key==='downtime')return downtime(host,args);return edit(host,args);}


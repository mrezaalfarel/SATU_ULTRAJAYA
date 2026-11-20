// Shared by the Pages Worker and the local verification suite.
class Problem extends Error { constructor(status,message){super(message);this.status=status;} }
function fail(message,status=422){throw new Problem(status,message);}
function obj(v){return v!==null && typeof v==='object' && !Array.isArray(v);}
function str(v,max=160,name='Isian',required=false){
 if(v==null)v=''; if(typeof v!=='string' || v.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(name+' tidak valid.');
 const s=v.trim();if(required&&!s)fail('Lengkapi '+name+'.');return s;
}
function uuid(v){if(typeof v!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(v))fail('ID tidak valid.');return v;}
function dateOK(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00Z'))&&new Date(s+'T12:00Z').toISOString().slice(0,10)===s;}
const reviewRoles=['admin','pengawas','management'];
const allRoles=['operator','foreman','pengawas','qc','management','admin','qa','ci'];
function clock(now=new Date()){
 const local=new Date(now.valueOf()+7*3600000).toISOString(), hm=local.slice(11,16);
 const shift=hm>='06:30'&&hm<'14:30'?'1':hm>='14:30'&&hm<'22:30'?'2':'3';
 const productionDay=hm<'06:30'?new Date(now.valueOf()+7*3600000-86400000).toISOString().slice(0,10):local.slice(0,10);
 const fillShift=hm>='22:00'||hm<'06:00'?'3':hm>='14:00'?'2':'1';
 const fillShifts=[...(hm<'06:30'||hm>='22:00'?['3']:[]),...(hm>='06:00'&&hm<'14:30'?['1']:[]),...(hm>='14:00'&&hm<'22:30'?['2']:[])];
 return {fillShift,fillShifts,day:productionDay,calendar:local.slice(0,10),hm,shift,hour:String(Number(hm.slice(0,2))||24),stamp:now.toISOString()};
}
function checkField(f,v,commit){
 if(v==null||v===''){if(commit&&f.required&&!f.computed)fail('Lengkapi '+f.label+'.');return '';}
 let s=str(String(v),f.type==='textarea'?2000:200,f.label,commit&&f.required&&!f.computed);
 if(s==='')return '';
 if(['select','check'].includes(f.type)&&!f.options.map(String).includes(s))fail('Pilihan '+f.label+' tidak terdaftar.');
 if(f.type==='date'&&!dateOK(s))fail(f.label+' harus berupa tanggal yang valid.');
 if(f.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail(f.label+' harus berupa jam dan menit.');
 if(['number','integer'].includes(f.type)){
  s=s.replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(+s)||Math.abs(+s)>1e12|| (f.type==='integer'&&!Number.isInteger(+s)) || (f.min!=null&&+s<f.min)||(f.max!=null&&+s>f.max))fail('Angka '+f.label+' tidak valid.');
  s=String(+s);
 }
 return s;
}
function rowOf(fields,raw,commit=false){
 if(!obj(raw))fail('Baris tidak valid.');
 const out={};for(const f of fields){if(f.computed)continue;const v=raw[f.key];if(v!=null&&!['string','number'].includes(typeof v))fail('Nilai '+f.label+' tidak valid.');const s=checkField(f,v,commit);if(s!=='')out[f.key]=s;}
 if(Object.keys(raw).some(k=>!fields.some(f=>f.key===k)))fail('Kolom tidak dikenal. Muat ulang formulir.');
 return out;
}
function duration(start,end){if(!start||!end)return '';const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));return String((minutes(end)-minutes(start)+1440)%1440);}
function calc(row,g,type){
 if(type==='FILL_CIP'&&row.Start&&row.Stop)row.Total=duration(row.Start,row.Stop);
 if(type==='FILL_EVENT'&&row.Stop&&row.Start)row.Duration=duration(row.Stop,row.Start);
 return row;
}
function same(a,b){return JSON.stringify(a??{})===JSON.stringify(b??{});}
function validateReport(input,existing,person,serverClock,commit=false){
 const def=CATALOG.find(d=>d.id===input.type);if(!def||!obj(input.doc)||!obj(input.doc.sections))fail('Format laporan tidak dikenal.');
 const raw=input.doc, meta=rowOf(def.meta,raw.meta,true), cook=Number(input.cook||0);
 if(!['1','2','3'].includes(meta.shift))fail('Pilih shift.');
 if(!(def.id==='PROCESS_MILK'?Number.isInteger(cook)&&cook>=1&&cook<=4:cook===0))fail('Nomor masakan tidak valid.');
 const sections={};if(Object.keys(raw.sections).some(k=>!def.sections.some(s=>s.id===k)))fail('Bagian tidak dikenal.');
 for(const g of def.sections){
  const rows=raw.sections[g.id]||{};if(!obj(rows))fail('Kelompok isian tidak valid.');
  const clean={};for(const [key,value] of Object.entries(rows)){
   const max=g.kind==='hourly'?24:g.kind==='matrix'?g.count:g.kind==='fields'?1:60;
   if(!/^[1-9]\d?$/.test(key)||+key>max)fail('Nomor isian '+g.title+' tidak valid.');
   const r=calc(rowOf(g.fields,value,commit),g,def.id);if(Object.keys(r).length)clean[key]=r;
  }
  if(Object.keys(clean).length)sections[g.id]=clean;
  const old=existing?.doc?.sections?.[g.id]||{};
  if(g.dailyLock&&Object.keys(clean).length)rowOf(g.fields,clean['1']||{},true);
  if(g.dailyLock&&Object.keys(old).length&&!same(normalizeRow(g.fields,old['1']),normalizeRow(g.fields,clean['1'])))fail('Checklist harian sudah dikunci.',409);
  if(commit)continue;
  if(g.supervisor&&!reviewRoles.includes(person.role)&&Object.keys({...clean,...old}).some(k=>!same(normalizeRow(g.fields,clean[k]),normalizeRow(g.fields,old[k]))))fail('Kontrol ini hanya dapat diisi pengawas.',403);
  if(g.kind==='hourly'||g.supervisor){
   for(const key of new Set([...Object.keys(old),...Object.keys(clean)])){
    if(!same(normalizeRow(g.fields,old[key]),normalizeRow(g.fields,clean[key]))&&g.kind==='hourly'&&
      (meta.date!==(def.id.startsWith('FILL_')||['ASEPTIC_GEA','STERILIZER_GEA'].includes(def.id)?serverClock.calendar:serverClock.day)||!(def.id.startsWith('FILL_')?serverClock.fillShifts:[serverClock.shift]).includes(meta.shift)||key!==serverClock.hour)){
      if(!existing||!reviewRoles.includes(person.role))fail('Isian per jam terkunci di luar jam dan shift aktif.',409);
      if(!str(input.note,800))fail('Isi alasan koreksi pengawas untuk mengubah parameter di luar jam aktif.',422);
    }
   }
  }
  if(['STERILIZER_GEA','ASEPTIC_GEA'].includes(def.id)&&g.id==='preheat'){
   for(const k of Object.keys(clean).map(Number))if(k>1&&!g.fields.every(f=>clean[String(k-1)]?.[f.key]))fail('Lengkapi preheating sebelumnya terlebih dahulu.');
  }
 }
 const first=g=>sections[g]?.['1']||{};
 if(commit){
  if(!Object.keys(sections).length)fail('Isi sedikitnya satu bagian sebelum mengirim.');
  if(def.id==='PROCESS_MILK')rowOf(def.sections.find(g=>g.id==='cook_ident').fields,first('cook_ident'),true);
  if(def.id==='PRODUCTION_TOTAL'){
   rowOf(def.sections[0].fields,first('quantities'),true);if(!meta.batch||!meta.lot||!meta.sku)fail('Rekap produksi memerlukan SKU, batch, dan lot.');
   const n=first('quantities');if(+n.good + +n.reject!==+n.actual)fail('Aktual harus sama dengan produk baik ditambah reject.');
  }
 }
 for(const k of ['product','sku','batch','lot'])meta[k]??='';
 if(def.id==='PROCESS_MILK'){const id=first('cook_ident');for(const k of ['product','batch','lot'])if(id['cook_'+k])meta[k]=id['cook_'+k];}
 const terms=new Set([meta.product,meta.sku,meta.batch,meta.lot,meta.unit,meta.stlz,meta.at,...Object.values(sections).flatMap(rows=>Object.values(rows).flatMap(row=>Object.entries(row).filter(([k])=>/batch|lot|sku|reel|productioncode|kode_produksi/i.test(k)).map(([,v])=>v)))].filter(Boolean).map(x=>x.toLowerCase()));
 const stats={};if(def.id==='PRODUCTION_TOTAL'){for(const k of ['target','actual','good','reject'])stats[k]=+first('quantities')[k]||0;}
 if(def.id==='FILL_EVENT'){
  stats.issues={};stats.planned=0;stats.unplanned=0;
  for(const id of ['technical','quality'])for(const r of Object.values(sections[id]||{})){
   if(r.class)stats[r.class.toLowerCase()]+=+r.Duration||0;
   if(id==='quality'&&r.Code)stats.issues[r.Code]=(stats.issues[r.Code]||0)+1;
  }
  stats.unplanned+=Object.values(first('short_stop')).reduce((a,x)=>a+(+x||0),0);
 }
 return {type:def.id,cook,doc:{meta,sections},terms:[...terms],stats};
}
function normalizeRow(fields,row){return row?Object.fromEntries(fields.filter(f=>row[f.key]!=null).map(f=>[f.key,String(row[f.key])])):{};}
function geofence(config,g){
 const num=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 const siteDefaults={SITE_LAT:'-6.867190',SITE_LON:'107.513711',SITE_RADIUS_M:'200',GPS_MAX_ACCURACY_M:'60'};
 const configured=(key,lo,hi)=>{const value=config[key]??siteDefaults[key];if(typeof value!=='string'||!value.trim()||!num(Number(value),lo,hi))fail('Admin perlu melengkapi konfigurasi lokasi pilot.',503);return Number(value);};
 const lat=configured('SITE_LAT',-90,90),lon=configured('SITE_LON',-180,180),radius=configured('SITE_RADIUS_M',1,10000),limit=configured('GPS_MAX_ACCURACY_M',1,1000);
 if(!g||!num(g.lat,-90,90)||!num(g.lon,-180,180)||!num(g.accuracy,0.01,limit))fail('Lokasi belum cukup akurat. Aktifkan lokasi presisi lalu coba lagi.',403);
 const rad=x=>x*Math.PI/180;
 const h=Math.sin(rad(g.lat-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(g.lat))*Math.sin(rad(g.lon-lon)/2)**2;
 if(6371000*2*Math.asin(Math.min(1,Math.sqrt(h)))+g.accuracy>radius)fail('Posisi perangkat di luar batas lokasi pilot.',403);
}


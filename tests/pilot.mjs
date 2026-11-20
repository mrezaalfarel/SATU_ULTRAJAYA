import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const f=await fixture();let groups=0;
const ok=async(label,test)=>{await test();groups++;console.log('OK',label);};
try{
 const {post,login,mod,env,db,ids,geo,catalog}=f;
 let operator,supervisor,admin,quality,management,processOperator,processReviewer,report,revision;const id=()=>crypto.randomUUID();
 const document=(type,day,shift,unit,sections,meta={})=>({id:id(),type,cook:0,version:0,op:id(),doc:{meta:{date:day,shift,unit,...meta},sections}});
 const t=mod.clock(), from=t.day,to=t.day;
 const expect=async(name,data,token,status)=>{const r=await post(name,data,token);assert.equal(r.status,status,name+' '+JSON.stringify(r.x));return r.x;};
 await ok('Geofence, akurasi, Origin, akun dan cookie sesi',async()=>{
  await expect('me',{},'',401);await expect('login',{employee:'op-uji',password:f.testPassword,geo:{lat:50,lon:0,accuracy:3}},'',403);
  await expect('login',{employee:'op-uji',password:f.testPassword,geo:{...geo,accuracy:100}},'',403);
  const cross=await post('login',{employee:'op-uji',password:f.testPassword,geo},'','https://other.test');assert.equal(cross.status,403);
  const bad={...env,SITE_LAT:''};assert.throws(()=>mod.geofence(bad,geo));operator=await login('op-uji');supervisor=await login('spv-uji');admin=await login('adm-uji');quality=await login('qc-uji');management=await login('mgmt-uji');processOperator=await login('op-proses');processReviewer=await login('spv-proses');
  assert.equal((await expect('me',{},operator,200)).person.role,'operator');
 });
 await ok('Semua 14 formulir dapat dibuat, disimpan dan dibaca melalui API',async()=>{
  const got=await expect('catalog',{},admin,200);assert.equal(got.length,14);assert.equal(got.reduce((n,x)=>n+x.sections.length,0),57);
  for(const def of got){const sample=document(def.id,t.day,t.shift,def.id==='PROCESS_MILK'?'1':'uji-'+def.id,{});if(def.id==='PROCESS_MILK')sample.cook=1; for(const fld of def.meta.filter(f=>f.required)){if(!sample.doc.meta[fld.key])sample.doc.meta[fld.key]=fld.options?.find(Boolean)||(fld.key==='stlz'?'Q':'1');}
   if(def.id==='SUPERVISOR_DAILY')await expect('save',sample,operator,403);
   const saved=await expect('save',sample,admin,200);const read=await expect('detail',{id:saved.id},admin,200);assert.equal(read.type,def.id);assert.equal(read.version,1);}
 });
 await ok('Transaksi, duplikasi, versi, penguncian, persetujuan independen',async()=>{
  report=document('PRODUCTION_TOTAL',t.day,t.shift,'Unit-1',{quantities:{1:{target:'120',actual:'100',good:'97',reject:'3'}}},{batch:'B-UJI',lot:'LOT-UJI',sku:'SKU-UJI'});
  const [w1,w2]=await Promise.all([post('save',report,management),post('save',report,management)]);assert.equal(w1.status,200);assert.equal(w2.status,200);
  await expect('save',{...report,id:id(),op:id()},management,409);await expect('save',{...report,op:id(),version:1},quality,403);
  const changed=await expect('save',{...report,op:id(),version:1},management,200);revision=changed.version;
  await expect('save',{...report,op:id(),version:1},management,409);
  await expect('submit',{id:report.id,op:id(),version:revision},management,200);
  await expect('approve',{id:report.id,op:id(),version:3},management,403);
  await expect('return',{id:report.id,op:id(),version:3,note:'Periksa lagi'},admin,200);
  await expect('submit',{id:report.id,op:id(),version:4},management,200);await expect('approve',{id:report.id,op:id(),version:5},admin,200);
  await expect('save',{...report,op:id(),version:6},management,403);
  const own=document('PRODUCTION_TOTAL',t.day,t.shift,'Unit-2',report.doc.sections,{sku:'S',batch:'B',lot:'L'});await expect('save',own,management,200);await expect('submit',{id:own.id,op:id(),version:1},management,200);
  assert.equal((await expect('detail',{id:own.id},management,200)).can_review,false);
  assert.equal((await expect('detail',{id:own.id},admin,200)).can_review,true);
  await expect('approve',{id:own.id,op:id(),version:2},management,403);
 });
 await ok('Tracing exact dan metrik hanya dari laporan disetujui',async()=>{
  const [r]=await expect('list',{from,to,q:'lot-uji'},management,200);assert.equal(r.id,report.id);const m=await expect('dashboard',{from,to},management,200);assert.equal(+m.good,97);assert.equal(+m.target,120);
 });
 await ok('Aturan isian jam, shift tengah malam dan urutan masakan',async()=>{
  assert.equal(mod.clock(new Date('2026-11-17T17:10:00Z')).hour,'24');assert.equal(mod.clock(new Date('2026-11-17T17:10:00Z')).day,'2026-11-17');
  assert.equal(mod.clock(new Date('2026-11-17T23:30:00Z')).shift,'1');
  const handover=mod.clock(new Date('2026-11-17T23:10:00Z'));assert.deepEqual(handover.fillShifts,['3','1']);assert.equal(handover.fillShift,'1');
  const maint=catalog.find(r=>r.id==='FILL_PRODUCTION').sections.find(s=>s.id==='maintenance');const check=Object.fromEntries(maint.fields.map(f=>[f.key,'V']));
  const daily=document('FILL_PRODUCTION',t.calendar,t.fillShift,'unit-maint',{maintenance:{1:check},hour:{[t.hour]:{TUBE_SPRINKLER:'V',FFU_FLUSHING:'='}}});
  await expect('save',daily,operator,200);await expect('save',{...daily,version:1,op:id(),doc:{...daily.doc,sections:{maintenance:{1:{...check,[maint.fields[0].key]:'X'}}}}},operator,409);
  const key=t.hour==='1'?'2':'1';const inp=document('FILL_VOLUME',t.calendar,t.fillShift,'hour',{hour:{[key]:{jaw_1:'-1'}}});
  await expect('save',inp,operator,409);inp.doc.sections.hour={[t.hour]:Object.fromEntries(Array.from({length:10},(_,i)=>['jaw_'+(i+1),'0']))};
  const partial=document('FILL_VOLUME',t.calendar,t.fillShift,'uji-koreksi',{});
  await expect('save',partial,operator,200);
  const corr={...partial,version:1,op:id(),doc:{...partial.doc,sections:{hour:{[key]:{jaw_1:'0'}}}}};
  await expect('save',corr,admin,422);await expect('save',{...corr,note:'Verifikasi buku shift sintetis'},admin,200);
  await expect('save',inp,operator,200);await expect('submit',{id:inp.id,version:1,op:id()},operator,200);
  const milk=document('PROCESS_MILK',t.day,t.shift,'2',{cook_ident:{1:{cook_product:'UHT',cook_batch:'BB',cook_lot:'LL',cook_st:'S1',cook_operator:'Nama'}}});
  await expect('save',{...milk,cook:2},processOperator,409);await expect('save',{...milk,cook:1},processOperator,200);await expect('submit',{id:milk.id,op:id(),version:1},processOperator,200);await expect('approve',{id:milk.id,op:id(),version:2},processReviewer,200);await expect('save',{...milk,cook:2,id:id(),op:id()},processOperator,200);
 });
 await ok('Event melewati tengah malam, dashboard dan pencatatan kemasan',async()=>{
  const blankUnit=document('FILL_CIP',t.day,t.shift,'  ',{});
  await expect('save',blankUnit,operator,422);
  const ev=document('FILL_EVENT',t.day,t.shift,'Unit Event',{quality:{1:{Stop:'23:58',Start:'00:06',Code:'AM',Desc:'Contoh',class:'Unplanned'}},short_stop:{1:{FM:'0,5'}}});
  await expect('save',ev,operator,200);
  assert.deepEqual(await expect('downtime',{from,to},operator,200),[]);
  await expect('submit',{id:ev.id,op:id(),version:1},operator,200);await expect('approve',{id:ev.id,op:id(),version:2},supervisor,200);
  const m=await expect('dashboard',{from,to},operator,200);assert.equal(Number(m.unplanned),8.5);assert.equal(m.issues[0].key,'AM');
  const page=await expect('downtime',{from,to},operator,200);assert.equal(page.length,1);
  assert.equal(page[0].id,ev.id);assert.equal(page[0].unplanned,8.5);assert.equal(page[0].planned,0);assert.deepEqual(page[0].issues,{AM:1});
  assert.deepEqual(await expect('downtime',{from,to,cursor_day:page[0].day,cursor_id:page[0].id},operator,200),[]);
 });
 await ok('Peran pengelola, kuis, manual, leaderboard dan arsip',async()=>{
  await expect('people',{},operator,403);const module={id:id(),title:'Manual Uji',category:'SOP',body:'Panduan pengujian dokumen contoh.',revision:'1',manual:true,active:true,questions:[{text:'Pilih A',options:['A','B'],correct:0}]};
  const scope=await f.worker.fetch(new Request('https://pilot.test/private/PROCESS_MILK.svg'),env);assert.equal(scope.status,401);
  const paper=await f.worker.fetch(new Request('https://pilot.test/private/PROCESS_MILK.svg',{headers:{Cookie:processOperator}}),env);assert.equal(paper.status,200);assert.ok((await paper.text()).includes('<svg'));
  await expect('module_save',module,operator,403);await expect('module_save',module,admin,200);
  const read=await expect('module',{id:module.id},operator,200);assert.equal('correct' in read.questions[0],false);
  await expect('visit',{id:module.id},operator,200);await expect('quiz',{id:module.id,answers:[1]},operator,200);await expect('finish',{id:module.id},operator,422);assert.equal((await expect('quiz',{id:module.id,answers:[0]},operator,200)).score,100);
  await expect('heartbeat',{id:module.id},operator,200);await expect('finish',{id:module.id},operator,200);assert.ok((await expect('leaderboard',{},operator,200)).length);
  assert.equal((await expect('leaderboard',{sort:'points'},operator,200))[0].points,100);
  assert.ok((await expect('modules',{category:'Mini Quiz'},operator,200)).some(x=>x.id===module.id));
  assert.ok(!(await expect('modules',{category:'Tutorial'},operator,200)).some(x=>x.id===module.id));
  assert.equal((await expect('ask',{q:'pengujian'},operator,200)).docs.length,1);
  await expect('module_save',{...module,revision:'2'},admin,200);
  await expect('finish',{id:module.id},operator,422);
  const draft=document('FILL_CIP',t.day,t.shift,'archive',{cip:{1:{Start:'23:55',Stop:'00:05'}}});
  await expect('save',draft,operator,200);await expect('archive',{id:draft.id,op:id(),version:1,note:'Duplikat'},operator,200);await expect('detail',{id:draft.id},operator,404);
  assert.deepEqual(await expect('list',{from,to,status:'ARCHIVED'},operator,200),[]);
  assert.equal((await expect('list',{from,to,status:'ARCHIVED'},admin,200))[0].id,draft.id);
 });
 await ok('Akun karyawan, admin terakhir, pencabutan sesi dan izin RPC',async()=>{
  await expect('account',{id:ids['adm-uji'],name:'Admin',employee:'adm-uji',role:'operator',active:true,workArea:'Filling',productionLines:[env.PILOT_LINE]},admin,409);
  const user={employee:'baru-uji',name:'Nama Sintetis',role:'qc',active:true,password:f.testPassword};
  const created=await expect('account',user,admin,200);const newSession=await login(user.employee);await expect('account',{...user,id:created.id,active:false},admin,200);await expect('me',{},newSession,401);
  const perm=await db.query("select has_function_privilege('anon','public.satu_gateway(text,jsonb,text)','EXECUTE') as anon,has_function_privilege('authenticated','public.satu_gateway(text,jsonb,text)','EXECUTE') as employee,has_function_privilege('service_role','public.satu_gateway(text,jsonb,text)','EXECUTE') as svc");
  assert.deepEqual(perm.rows[0],{anon:false,employee:false,svc:true});
  await expect('logout',{},operator,200);await expect('me',{},operator,401);
 });
 console.log(groups+' kelompok uji lulus.');
}finally{await f.close();}


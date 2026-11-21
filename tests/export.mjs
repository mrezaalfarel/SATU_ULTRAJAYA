// Check the actual filtered API as well as the bytes users download.
import assert from 'node:assert/strict';
import {exportFilteredReports} from '../pages/export.js';
import {fixture} from './fixture.mjs';

const f=await fixture();
try{
 const token=await f.login('op-uji'),admin=await f.login('adm-uji');
 const day=f.mod.clock().calendar,filters={from:day,to:day,type:'FILL_EVENT',q:'SKU-CSV'};
 async function call(name,body,session=token){
  const r=await f.post(name,body,session);
  assert.equal(r.status,200,JSON.stringify(r.x));return r.x;
 }
 async function draft(i,type='FILL_EVENT',session=token){
  return call('save',{id:crypto.randomUUID(),op:crypto.randomUUID(),version:0,type,cook:0,
   doc:{meta:{date:day,shift:'1',unit:'FM-'+i,sku:'SKU-CSV'},sections:type==='FILL_EVENT'?
    {quality:{1:{Stop:'10:00',Start:'10:01',Code:'AM',Desc:'=UJI("CSV")',class:'Unplanned'}}}:{}}},session);
 }
 for(let i=0;i<23;i++)await draft(i);
 const excluded=await draft('archive');
 await call('archive',{id:excluded.id,version:1,op:crypto.randomUUID(),note:'Uji arsip'});
 await draft('packing','PACKING_CBP',admin);
 const summary=await call('list',filters);
 assert.ok(!('doc' in summary[0]));
 const bytes=[];
 let aborted=false,closed=false;
 globalThis.window={showSaveFilePicker:async()=>({createWritable:async()=>({
  write:part=>bytes.push(Buffer.from(part)),close:()=>{closed=true;},abort:async()=>{aborted=true;}
 })})};
 const options={filters,api:call,catalog:f.catalog,active:()=>true,progress:()=>{}};
 const count=await exportFilteredReports(options);
 assert.equal(count,23);
 const csv=Buffer.concat(bytes).toString('utf8');
 assert.ok(csv.startsWith('\uFEFF"ID","Versi"'));
 assert.ok(csv.includes(`"'=UJI(""CSV"")"`));
 assert.ok(!csv.includes(excluded.id));
 assert.ok(csv.includes('"Duration"'));
 assert.equal(new Set([...csv.matchAll(/^"([0-9a-f-]{36})"/gm)].map(m=>m[1])).size,23);
 assert.ok(closed && !aborted);
 assert.deepEqual(await call('list',{...filters,type:'PACKING_CBP',export:true}),[]);
 let active=true;
 await assert.rejects(exportFilteredReports({...options,active:()=>active,progress:()=>{active=false;}}),{name:'AbortError'});
 assert.ok(aborted);
 console.log('OK CSV lengkap tiga halaman, versi dan parameter tersimpan, scope area, arsip, formula teks dan pembatalan');
}finally{await f.close();}

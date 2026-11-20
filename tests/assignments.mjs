import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';

const f = await fixture();
try {
  const admin = await f.login('adm-uji');
  const lines = ['Filling 57','Sterilizer'];
  async function call(cookie, action, data, status=200) {
    const result = await f.post(action,data,cookie);
    assert.equal(result.status,status,action+' '+JSON.stringify(result.x));
    return result.x;
  }
  const filling = {name:'Operator Uji',employee:'filling-57',role:'operator',active:true,productionLines:[lines[0]],workArea:'Filling',password:f.testPassword};
  const fillProfile = await call(admin,'account',filling);
  const sterilizer = {...filling,employee:'operator-sterilizer',productionLines:[lines[1]],workArea:'Sterilizer - Aseptic Tank'};
  await call(admin,'account',sterilizer);
  await call(admin,'account',{...filling,employee:'spv-dua',workArea:'Filling - Packing',role:'pengawas',productionLines:lines});
  const op = await f.login(filling.employee), other = await f.login(sterilizer.employee), spv = await f.login('spv-dua');
  assert.equal((await call(op,'me',{})).line,lines[0]);
  assert.equal((await call(other,'me',{})).line,lines[1]);
  assert.deepEqual(new Set((await call(op,'catalog',{})).map(x=>x.area)),new Set(['Filling']));
  assert.deepEqual(new Set((await call(other,'catalog',{})).map(x=>x.area)),new Set(['Sterilizer','Aseptic Tank']));
  const privateArt=(name,token)=>f.worker.fetch(new Request('https://pilot.test/private/'+name,{headers:{Cookie:token}}),f.env);
  assert.equal((await privateArt('STERILIZER_GEA.webp',op)).status,404);
  assert.equal((await privateArt('STERILIZER_GEA.webp',other)).status,200);
  const now=f.mod.clock(), range={from:now.calendar,to:now.calendar};
  const report = (type,line) => ({id:crypto.randomUUID(),op:crypto.randomUUID(),version:0,cook:0,type,line,doc:{meta:{date:now.calendar,shift:'1',unit:'Unit uji'},sections:{}}});
  const event = report('FILL_EVENT',lines[0]);
  await call(op,'save',event);
  const sterileLineEvent = report('FILL_EVENT',lines[1]);
  await call(spv,'save',sterileLineEvent,403);
  await call(admin,'account',{...filling,employee:'op-dua',productionLines:lines});
  await call(await f.login('op-dua'),'save',sterileLineEvent);
  await call(other,'save',report('FILL_CIP',lines[1]),403);
  await call(op,'list',{...range,line:lines[1]},403);
  await call(other,'detail',{id:sterileLineEvent.id},404);
  await call(other,'archive',{id:sterileLineEvent.id,op:crypto.randomUUID(),version:1,note:'uji'},404);
  assert.deepEqual(await call(other,'list',range),[]);
  assert.equal((await call(other,'dashboard',range)).reports,0);
  assert.equal((await call(spv,'detail',{id:sterileLineEvent.id,line:lines[1]})).id,sterileLineEvent.id);
  await call(spv,'detail',{id:sterileLineEvent.id,line:lines[0]},404);
  await call(op,'save',{...event,line:lines[1]},403);
  await call(admin,'account',{...filling,id:fillProfile.id,productionLines:['Filling 58']});
  await call(op,'me',{},401);
  assert.equal((await call(await f.login(filling.employee),'me',{})).line,'Filling 58');
  console.log('OK akun Filling/Sterilizer, katalog per area, isolasi data dan rekap, pengawas dua line, sesi penugasan lama dicabut');
  const defaultSite = {};
  assert.doesNotThrow(()=>f.mod.geofence(defaultSite,{lat:-6.867190,lon:107.513711,accuracy:5}));
  assert.throws(()=>f.mod.geofence(defaultSite,{lat:-6.86543,lon:107.513711,accuracy:15}),{status:403});
  assert.throws(()=>f.mod.geofence(defaultSite,{lat:-6.864,lon:107.513711,accuracy:5}),{status:403});
  console.log('OK titik pabrik dan batas radius 200 m termasuk ketidakpastian GPS');
  // Reapplication on an already populated database preserves assignments and reports.
  await f.db.exec(await readFile(new URL('../supabase/01_install.sql',import.meta.url),'utf8'));
  assert.equal((await call(spv,'detail',{id:event.id,line:lines[0]})).id,event.id);
  assert.equal((await call(other,'me',{})).person.workArea,'Sterilizer - Aseptic Tank');
  console.log('OK instal ulang skema pada database berisi laporan dan penugasan');
} finally {await f.close();}

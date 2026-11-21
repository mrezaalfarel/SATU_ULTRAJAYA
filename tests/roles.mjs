import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

const f = await fixture();
try {
  const admin = await f.login('adm-uji');
  const line = f.env.PILOT_LINE;
  const clock = f.mod.clock();
  const uuid = () => crypto.randomUUID();
  async function call(session, action, data, expected = 200) {
    const result = await f.post(action, data, session);
    assert.equal(result.status, expected, action + ' ' + JSON.stringify(result.x));
    return result.x;
  }
  async function invalidProfile(data) {
    const {status, x} = await f.post('account', data, admin);
    assert.ok([409,422].includes(status), 'account ' + status + ' ' + JSON.stringify(x));
  }
  const filling = ['FILL_PRODUCTION','FILL_PACK','FILL_VOLUME','FILL_EVENT','FILL_CIP'];
  const packing = ['PACKING_CBP','PACKING_STRAW'];
  const sterilizer = ['STERILIZER_GEA','ASEPTIC_GEA','ASEPTIC_CIP'];
  const process = ['PROCESS_MILK','PROCESS_CIP_PAST'];
  const reviewerArea = ['Filling - Packing','InProses','Proses'];
  const supervisors = ['spv-uji','spv-steril','spv-proses'];
  const families = [filling.concat(packing),sterilizer,process];
  const leads = [];
  function foreman(employee, i, other = {}) {
    return {
      name:employee, employee, role:'foreman', workArea:reviewerArea[i], active:true,
      productionLines:[line], supervisorId:f.ids[supervisors[i]], password:f.testPassword, ...other
    };
  }
  await invalidProfile(foreman('wrong-family', 0, {supervisorId:f.ids['spv-steril']}));
  await invalidProfile(foreman('wrong-line', 0, {productionLines:['Line Z']}));
  await invalidProfile(foreman('wrong-superior', 0, {supervisorId:f.ids['op-uji']}));
  await invalidProfile(foreman('missing-superior', 0, {supervisorId:null}));
  for (let i=0; i<families.length; i++) {
    const profile = foreman('foreman-'+i,i);
    const created = await call(admin,'account',profile);
    const session = await f.login(profile.employee);
    leads.push({profile, id:created.id, session});
    const {person} = await call(session,'me',{});
    assert.equal(person.supervisorId,profile.supervisorId);
    assert.deepEqual(new Set((await call(session,'catalog',{})).map(r=>r.id)),new Set(families[i]));
    assert.deepEqual(new Set((await call(await f.login(supervisors[i]),'catalog',{})).map(r=>r.id)),new Set(families[i]));
    await call(session,'people',{},403);
  }
  for (const [employee, expected] of [
    ['op-uji', filling], ['op-packing',packing], ['op-steril',sterilizer], ['op-proses',process]
  ]) {
    const session = await f.login(employee);
    assert.deepEqual(new Set((await call(session,'catalog',{})).map(r=>r.id)),new Set(expected));
  }
  console.log('OK katalog 4 kelompok operator, 3 kelompok pengawas, 3 kelompok foreman');

  const op = await f.login('op-uji'), supervisor = await f.login('spv-uji');
  const doc = {id:uuid(),op:uuid(),version:0,cook:0,type:'FILL_EVENT',doc:{
    meta:{date:clock.calendar,shift:clock.fillShift,unit:'Unit foreman',lot:'LOT-TEAM'},
    sections:{quality:{1:{Stop:'11:00',Start:'11:15',Code:'AM',Desc:'Temuan uji',class:'Unplanned'}}}
  }};
  for (const reviewer of [supervisor,leads[0].session]) await call(reviewer,'save',doc,403);
  await call(op,'save',doc);
  const act=(version,note='')=>({id:doc.id,version,op:uuid(),note});
  for (const reviewer of [supervisor,leads[0].session]) {
    await call(reviewer,'save',{...doc,op:uuid(),version:1},403);
    await call(reviewer,'submit',act(1),403);
    await call(reviewer,'archive',act(1,'uji'),403);
  }
  await call(op,'submit',act(1));
  await call(op,'approve',act(2),403);
  for (const outside of [await f.login('spv-steril'),leads[2].session]) {
    await call(outside,'detail',{id:doc.id},404);
    await call(outside,'approve',act(2),404);
    const range = {from:clock.calendar,to:clock.calendar};
    assert.deepEqual(await call(outside,'list',{...range,q:'LOT-TEAM'}),[]);
    assert.equal((await call(outside,'dashboard',range)).pending,0);
  }
  await call(leads[0].session,'return',act(2,'Perbaiki keterangan'));
  await call(op,'submit',act(3));
  await call(leads[0].session,'approve',act(4));
  const stored = await call(supervisor,'detail',{id:doc.id});
  assert.equal(stored.status,'APPROVED');
  assert.equal(stored.history[0].name,'foreman-0');
  await call(op,'save',{...doc,version:5,op:uuid()},403);
  console.log('OK draf, kirim, retur foreman, kirim ulang, persetujuan independen dan laporan terkunci');

  const extra = [];
  for (let i=1; i<4; i++) {
    const profile=foreman('sub-filling-'+i,0);
    extra.push({...profile,id:(await call(admin,'account',profile)).id});
  }
  await invalidProfile(foreman('sub-kelima',0));
  const supervisorProfile={id:f.ids['spv-uji'],employee:'spv-uji',name:'Supervisor',
    workArea:reviewerArea[0],role:'pengawas',productionLines:[line],active:true};
  for(const change of [{active:false},{productionLines:['Line Z']},{workArea:'Proses'}]) {
    await invalidProfile({...supervisorProfile,...change});
  }
  await call(admin,'account',{...extra[0],active:false});
  await call(admin,'account',foreman('sub-kelima',0));
  await invalidProfile({...extra[0],active:true});
  console.log('OK supervisor, kesesuaian area/line, kuota 4 foreman aktif dan pergantian anggota');
} finally {
  await f.close();
}

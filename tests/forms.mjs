// Exercise all report types through the same API used by the browser.
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';

const f = await fixture();
try {
  const staffByArea = {
    Filling:['op-uji','spv-uji'], Packing:['op-packing','spv-uji'],
    Sterilizer:['op-steril','spv-steril'], 'Aseptic Tank':['op-steril','spv-steril'],
    Proses:['op-proses','spv-proses']
  };
  const tokens = {};
  for(const user of new Set([...Object.values(staffByArea).flat(),'mgmt-uji','adm-uji'])) tokens[user]=await f.login(user);
  const clock = f.mod.clock();
  function sample(field) {
    if (field.options) return String(field.options.find(option=>String(option).length));
    if (field.type==='date') return clock.calendar;
    if (field.type==='time') return '12:10';
    if (['integer','number'].includes(field.type)) return String(field.min??0);
    return 'Uji';
  }
  for (const form of f.catalog) {
    const id = crypto.randomUUID(), group = form.sections[0];
    const meta = Object.fromEntries(form.meta.filter(x=>x.required).map(x=>[x.key,sample(x)]));
    Object.assign(meta,{date:clock.calendar,shift:form.id.startsWith('FILL_')?clock.fillShift:clock.shift,batch:'B-UJI',lot:'L-UJI',sku:'SKU-UJI'});
    const values = Object.fromEntries(group.fields.filter(x=>!x.computed).map(x=>[x.key,sample(x)]));
    if (form.id==='PRODUCTION_TOTAL') Object.assign(values,{target:'10',actual:'10',good:'9',reject:'1'});
    const doc = {meta,sections:{[group.id]:{[group.kind==='hourly'?clock.hour:'1']:values}}};
    const [authorName,reviewerName]=['SUPERVISOR_DAILY','PRODUCTION_TOTAL'].includes(form.id)
      ? ['mgmt-uji','adm-uji'] : staffByArea[form.area];
    const author=tokens[authorName],reviewer=tokens[reviewerName];
    let version = 0;
    for (const action of ['save','submit','approve']) {
      const r = await f.post(action,{doc,type:form.id,cook:form.id==='PROCESS_MILK'?1:0,id,version,op:crypto.randomUUID()},action==='approve'?reviewer:author);
      assert.equal(r.status,200,form.id+' '+action+' '+JSON.stringify(r.x));
      version=r.x.version;
    }
    const {x:stored}=await f.post('detail',{id},reviewer);
    assert.equal(stored.status,'APPROVED');
    assert.deepEqual(stored.history.map(h=>h.action),['approve','submit','save']);
  }
  console.log('OK 14 jenis laporan melalui simpan, kirim, persetujuan terpisah dan baca riwayat');
} finally {await f.close();}

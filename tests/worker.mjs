import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';

const f = await fixture();
const origin = 'https://pilot.test';
const { env, worker, login, post, db } = f;

try {
  const operator = await login('op-uji');
  const admin = await login('adm-uji');

  // Successful logins at a shared factory NAT must leave the failure budget intact.
  const successfulHits = await db.query('select hits from satu.throttle');
  assert.ok(successfulHits.rows.length >= 3);
  assert.ok(successfulHits.rows.every(row => row.hits === 0));
  const badPassword = { employee: 'op-uji', password: 'incorrect', geo: f.geo };
  assert.equal((await post('login', badPassword)).status, 401);
  await login('op-uji');
  const failedHits = await db.query('select hits from satu.throttle where hits > 0');
  assert.deepEqual(failedHits.rows.map(row => row.hits), [1, 1]);
  assert.equal((await post('password', { current: 'incorrect', password: 'synthetic-new-password' }, operator)).status, 422);
  assert.equal((await post('me', {}, operator)).status, 200);
  console.log('OK login bersama mempertahankan kuota untuk kegagalan dan koreksi kata sandi menjaga sesi');

  const moduleId = crypto.randomUUID();
  const privateUrl = origin + '/private/PROCESS_MILK.svg';
  const ip = '192.0.2.10';
  const local = { Cookie: operator, 'CF-Connecting-IP': ip };
  const gated = { ...env, SITE_IP_ALLOWLIST: ip };
  assert.equal((await worker.fetch(new Request(privateUrl, { headers: { Cookie: operator } }), gated)).status, 403);
  assert.equal((await worker.fetch(new Request(privateUrl, { headers: local }), gated)).status, 200);

  const upload = cookie => worker.fetch(new Request(origin + '/api/upload?module=' + moduleId + '&ext=pdf', {
    method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: '%PDF-1.4 synthetic attachment'
  }), env);
  assert.equal((await upload(operator)).status, 403);
  const uploaded = await upload(admin);
  assert.equal(uploaded.status, 200);
  const { attachment } = await uploaded.json();
  const module = {
    id: moduleId, title: 'Manual sintetis', category: 'SOP', body: 'Kutipan untuk uji.',
    revision: '01', manual: true, active: true, attachment, questions: []
  };
  assert.equal((await post('module_save', module, admin)).status, 200);
  const file = () => worker.fetch(new Request(origin + '/api/file?id=' + moduleId, { headers: local }), env);
  assert.equal(await (await file()).text(), '%PDF-1.4 synthetic attachment');
  assert.equal((await post('module_save', { ...module, active: false }, admin)).status, 200);
  assert.equal((await file()).status, 404);
  console.log('OK formulir privat mengikuti akses jaringan dan lampiran mengikuti status publikasi modul');

  const oldKey = env.SUPABASE_PUBLISHABLE_KEY;
  try {
    for (const key of [env.SUPABASE_SECRET_KEY, 'sb_secret_fake', 'eyJ0.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.sig']) {
      env.SUPABASE_PUBLISHABLE_KEY = key;
      const response = await post('live', {}, operator);
      assert.equal(response.status, 503);
      assert.ok(!JSON.stringify(response.x).includes(key));
    }
  } finally {
    env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const question = { q: 'Periksa contoh gambar.', image: png.toString('base64') };
  assert.equal((await post('ask', question, operator)).status, 503);
  let modelCalls = 0;
  env.AI = { run: async () => { modelCalls++; throw Error('simulated AI outage'); } };
  const failedModel = await post('ask', question, operator);
  assert.equal(failedModel.status, 200);
  assert.equal(failedModel.x.reply, '');
  assert.match(failedModel.x.notice, /QC/);
  assert.equal(modelCalls, 1);
  const tooBig = Buffer.alloc(1024 * 1024 + 1);
  png.copy(tooBig);
  assert.equal((await post('ask', { ...question, image: tooBig.toString('base64') }, operator)).status, 422);
  assert.equal(modelCalls, 1);
  console.log('OK pencegahan key privat masuk ke klien dan penanganan foto serta model tidak tersedia');
} finally {
  await f.close();
}

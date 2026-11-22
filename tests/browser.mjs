// Chrome DevTools Protocol, genuine browser UI, isolated synthetic local PostgreSQL.
import {fixture} from './fixture.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../',import.meta.url));
const output = path.join(root, 'dist');
const worker = (await import('../dist/_worker.js')).default;
const routes = JSON.parse(await fs.readFile(path.join(output,'_routes.json'),'utf8'));
const isWorkerRoute = path => routes.include.some(route =>
 route.endsWith('/*') ? path.startsWith(route.slice(0,-1)) : route === path);
assert.deepEqual(routes.exclude, []);
const assetHeaders = {};
for (const line of (await fs.readFile(path.join(output, '_headers'), 'utf8')).split(/\r?\n/)) {
 const parts = line.match(/^\s+([\w-]+):\s*(.+)$/);
 if (parts) assetHeaders[parts[1]] = parts[2];
}
const f = await fixture();
const modelCalls = [];
f.env.AI = {
 async run(model, input) {
  const photo = Array.isArray(input.image) && input.image.length > 0;
  modelCalls.push({model, photo, context:input.messages?.at(-1)?.content});
  return {response:photo
   ? JSON.stringify({classification:'abnormal',observation:'Tanda latihan pada foto sintetis.',reference:'[1]'})
   : 'Penjelasan berdasarkan kartu pemeriksaan sintetis [1].'};
 }
};
for (const key of ['SITE_LAT','SITE_LON','SITE_RADIUS_M','GPS_MAX_ACCURACY_M']) delete f.env[key];
let interruptNextSave = false;
const http = createServer(async (req,res) => {
 try {
  const url = new URL(req.url, 'http://' + req.headers.host);
  if (isWorkerRoute(url.pathname)) {
   const chunks = [];
   for await (const chunk of req) chunks.push(chunk);
   const request = new Request(url,{method:req.method,headers:req.headers,
    ...(chunks.length ? {body:Buffer.concat(chunks)} : {})});
   const result = await worker.fetch(request, f.env);
   if (interruptNextSave && url.pathname === '/api/save' && result.ok) {
    // The database committed but the operator did not receive the acknowledgement.
    interruptNextSave = false;
    res.writeHead(200, {'Content-Type':'application/json', 'Content-Length':'150'});
    res.write('{"id":');
    setTimeout(()=>res.destroy(),60);
    return;
   }
   res.writeHead(result.status,Object.fromEntries(result.headers));
   res.end(Buffer.from(await result.arrayBuffer()));
  } else {
   const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
   if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(name)) {res.writeHead(404);res.end();return;}
   const content = await fs.readFile(path.join(output,name)).catch(() => null);
   const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
   res.writeHead(content ? 200 : 404, {...assetHeaders,'Content-Type':types[path.extname(name)] || 'application/octet-stream'});
   res.end(content);
  }
 } catch (error) {
  console.error(error);
  if (!res.headersSent) res.writeHead(500);
  res.end();
 }
});
await new Promise((ok,no)=>{http.once('error',no);http.listen(0,'127.0.0.1',ok);});const origin='http://localhost:'+http.address().port;
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'satu-ui-'));
const executable = process.env.CHROME_BIN || (process.platform === 'darwin'
 ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
 : process.platform === 'win32' ? 'chrome.exe' : 'chromium');
const flags = ['--headless','--disable-gpu','--disable-dev-shm-usage','--no-first-run',
 '--use-fake-device-for-media-stream','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+tmp];
if (process.env.CHROME_TEST_NO_SANDBOX === '1') flags.push('--no-sandbox');
const chrome = spawn(executable, [...flags,'about:blank'], {stdio:'ignore',
 env: {...process.env, XDG_CONFIG_HOME:tmp, XDG_CACHE_HOME:tmp}});
let launchError, sock;
chrome.on('error', error => {launchError = error;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let port;for(let i=0;i<80&&!port;i++){if(launchError)throw launchError;if(chrome.exitCode!==null||chrome.signalCode)throw Error('Chrome berhenti sebelum siap. Periksa CHROME_BIN dan konfigurasi sandbox mesin uji.');try{port=(await fs.readFile(path.join(tmp,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await pause(150);}}if(!port)throw Error('Chrome headless tidak dapat dijalankan');
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();sock=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,no)=>{sock.onopen=ok;sock.onerror=no;});
 const pending=new Map(),errors=[];let seq=0;sock.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(Error(m.error.message)):yes(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((yes,no)=>{pending.set(++seq,[yes,no]);sock.send(JSON.stringify({id:seq,method,params}));});
 const ev=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
 const wait=async(expr)=>{for(let i=0;i<90;i++){if(await ev(expr))return;await pause(100);}throw Error('UI tidak mencapai '+expr+'; '+await ev('document.body.innerText.slice(-600)'));};
 await send('Runtime.enable');await send('Page.enable');await send('Browser.grantPermissions',{origin,permissions:['geolocation','videoCapture']});await send('Emulation.setGeolocationOverride',{latitude:-6.867190,longitude:107.513711,accuracy:4});
 await send('Page.navigate',{url:origin});await wait("document.querySelector('#login') && !document.querySelector('#login').hidden");
 await send('Emulation.setGeolocationOverride',{latitude:1,longitude:1,accuracy:4});
 await ev("loginForm.employee.value='op-uji';loginForm.password.value='Khusus-pengujian-01';loginForm.requestSubmit()");
 await wait("document.querySelector('#loginStatus').classList.contains('bad') && document.querySelector('#shell').hidden");
 assert.match(await ev("document.querySelector('#loginStatus').textContent"), /area|lokasi|radius/i);
 await send('Emulation.setGeolocationOverride',{latitude:-6.867190,longitude:107.513711,accuracy:4});
 await ev("loginForm.employee.value='mgmt-uji';loginForm.password.value='Khusus-pengujian-01';loginForm.requestSubmit()");await wait("!document.querySelector('#shell').hidden && !!document.querySelector('#queue')");
 await ev("document.querySelector('#newRpt').click()");await wait("!!document.querySelector('[data-section=Supervisor]')");await ev("document.querySelector('[data-section=Supervisor]').click()");await wait("!!document.querySelector('[data-new=PRODUCTION_TOTAL]')");await ev("document.querySelector('[data-new=PRODUCTION_TOTAL]').click()");await wait("!!document.querySelector('[data-meta=unit]') && !!document.querySelector('[data-key=good]')");
 interruptNextSave = true;
 await ev("for(const [s,v] of Object.entries({'[data-meta=unit]':'FM-UJI','[data-meta=batch]':'B-BROWSER','[data-meta=sku]':'SKU-UJI','[data-meta=lot]':'LOT-BROWSER','[data-key=good]':'95','[data-key=reject]':'5','[data-key=actual]':'100','[data-key=target]':'120'})){const el=document.querySelector(s);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('#save').click()");
 await wait("/Jaringan terputus|Respons API Cloudflare tidak terbaca/.test(document.querySelector('#flash')?.textContent)");
 await ev("document.querySelector('#save').click()");
 await wait("!!document.querySelector('[data-act=submit]')");await ev("document.querySelector('[data-act=submit]').click()");await wait("!!document.querySelector('dialog[open]')");await ev("document.querySelector('dialog button[value=ok]').click()");await wait("document.querySelector('.modebar .tag')?.textContent.includes('Menunggu')");
 await ev("document.querySelector('[data-go=trace]').click()");await wait("!!document.querySelector('[name=q]')");await ev("document.querySelector('[name=q]').value='LOT-BROWSER';document.querySelector('#main form').requestSubmit()");await wait("document.querySelector('#matches')?.innerText.includes('B-BROWSER')");
 await ev("document.querySelector('[data-open]').click()");await wait("!!document.querySelector('#print')");await ev("window.print=()=>{window.printText=document.querySelector('#printRoot').innerText};document.querySelector('#print').click()");await wait("Boolean(document.querySelector('#printRoot table'))");
 const saved = (await f.db.query("select count(*) as entries, max(version) as version from satu.reports where lot='LOT-BROWSER'")).rows[0];
 assert.equal(Number(saved.entries),1);
 assert.equal(Number(saved.version),2);
 console.log('OK Chrome · geofence, simpan ulang setelah koneksi terputus, satu laporan, kirim, tracing, cetak');
 // Exercise each original printable overlay with data shaped like the UI record.
 await ev(`(async()=>{const {app}=await import('/app.js');const {printReport}=await import('/print.js');for(const d of app.catalog.slice(0,8)){await printReport({id:'test',type:d.id,day:app.clock.day,line:'Sintetis',unit:'1',shift:1,cook:d.id==='PROCESS_MILK'?1:0,version:1,status:'DRAFT',doc:{meta:{date:app.clock.day,unit:'1'},sections:{}}},d);if(!document.querySelector('#printRoot img')?.naturalWidth)throw Error('Gambar '+d.id);}})()`);
 console.log('OK Chrome · 8 latar cetak asli termuat');
 const openLogin = async employee => {
  await ev("document.querySelector('#logout').click()");
  await wait("!document.querySelector('#login').hidden");
  await ev(`loginForm.employee.value=${JSON.stringify(employee)};loginForm.password.value='Khusus-pengujian-01';loginForm.requestSubmit()`);
  await wait("!document.querySelector('#shell').hidden && !!document.querySelector('#queue')");
 };
 await openLogin('adm-uji');
 const kpi = index => `parseInt(document.querySelectorAll('.kpis .card strong')[${index}]?.textContent, 10)`;
 assert.equal(await ev(kpi(0)), 0);
 await ev("document.querySelector('#queue').click()");
 await wait("document.querySelector('#matches')?.innerText.includes('LOT-BROWSER')");
 await ev("document.querySelector('#matches [data-open]').click()");
 await wait("!!document.querySelector('[data-act=approve]')");
 await ev("document.querySelector('[data-act=approve]').click()");
 await wait("!!document.querySelector('dialog[open]')");
 await ev("document.querySelector('dialog button[value=ok]').click()");
 await wait("!!document.querySelector('.modebar .APPROVED')");
 await ev("document.querySelector('[data-go=dashboard]').click()");
 await wait(kpi(0) + " === 100");
 assert.equal(await ev(kpi(1)), 95);
 assert.match(await ev("document.querySelectorAll('.kpis .card')[1].textContent"), /5 pak reject/);
 console.log('OK Chrome · akun admin menyetujui rekap management, dashboard mencatat aktual 100, baik 95, reject 5');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await ev("document.querySelector('#menu').click()");await wait("getComputedStyle(document.querySelector('#sidebar')).display!=='none'");
 assert.ok(await ev('document.documentElement.scrollWidth<=window.innerWidth+1'));await ev("document.querySelector('[data-go=education]').click()");await wait("document.querySelector('#main h1')?.textContent==='Education Corner'");
 assert.deepEqual(errors,[]);console.log('OK Chrome · navigasi ponsel 390 px dan Education Corner');
 await send('Emulation.clearDeviceMetricsOverride');
 const click = async selector => {
  await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
 };
 const fill = async (selector,value) => {
  await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  await ev(`{const field=document.querySelector(${JSON.stringify(selector)});field.value=${JSON.stringify(value)};field.dispatchEvent(new Event('input',{bubbles:true}));if(field.tagName==='SELECT')field.dispatchEvent(new Event('change',{bubbles:true}));}`);
 };
 const goMenu = route => click('[data-go='+route+']');
 await goMenu('management');
 await click('#addUser');
 await fill('#editor [name=employee]', 'op-baris');
 await fill('#editor [name=name]', 'Pengisi Filling 57');
 await fill('#editor [name=lineNames]', 'Filling 57, Filling 58');
 await fill('#editor [name=workArea]', 'Filling');
 await fill('#editor [name=password]', f.testPassword);
 await click('#editor .primary');
 await wait("document.querySelector('#accounts')?.innerText.includes('op-baris')");
 await click('#addUser');
 await fill('#editor [name=employee]','fm-browser');
 await fill('#editor [name=name]','Foreman Uji');
 await fill('#editor [name=role]','foreman');
 await fill('#editor [name=workArea]','Filling - Packing');
 await fill('#editor [name=lineNames]','Line Uji');
 await wait(`[...document.querySelectorAll('[name=supervisorId] option')].some(option=>option.value===${JSON.stringify(f.ids['spv-uji'])})`);
 await fill('#editor [name=supervisorId]',f.ids['spv-uji']);
 await fill('#editor [name=password]',f.testPassword);
 await click('#editor .primary');
 await wait("document.querySelector('#accounts')?.innerText.includes('fm-browser')");
 await click('#notice');
 await fill('#editor [name=title]', 'Pemberitahuan Uji');
 await fill('#editor [name=body]', 'Untuk pengujian lokal.');
 await click('#editor .primary');
 await wait("document.querySelector('#notes')?.innerText.includes('Pemberitahuan Uji')");
 await goMenu('education');
 await click('#add');
 await fill('[name=title]', 'Manual pelatihan uji');
 await fill('[name=body]', 'Kartu sintetis berisi panduan pemeriksaan kemasan untuk uji aplikasi.');
 await fill('[name=doc_no]','SOP-UJI-01');
 await click('.addq');
 await fill('.qt','Apa nama objek latihan?');
 await fill('.qo','Kartu\nBuku');
 await click('#main [type=submit]');
 await wait("document.querySelector('#main .book')?.innerText.includes('Manual pelatihan uji')");
 await openLogin('op-uji');
 assert.equal(await ev("document.querySelector('[data-go=management]')"),null);
 await click('.notice-bell summary');
 await wait("document.querySelector('.results')?.innerText.includes('Pemberitahuan Uji')");
 await goMenu('education');
 await click('#main [data-open]');
 await click('[name=q0][value="0"]');
 await click('#main form .primary');
 await wait("document.querySelector('#score')?.textContent.includes('100/100')");
 await click('#finish');
 await wait("document.querySelector('#main .book')?.innerText.includes('Selesai')");
 await fill('#rankMetric','points');
 await wait("document.querySelector('.learning-rank')?.innerText.includes('100 poin')");
 await ev(`window.SpeechRecognition=class {start(){setTimeout(()=>{this.onresult({resultIndex:0,results:[[{transcript:'Suara uji'}]]});this.onend();},5);}stop(){}abort(){}}`);
 await goMenu('ask');
 await click('#mic');
 await wait("document.querySelector('[name=q]').value==='Suara uji'");
 await fill('#main [name=q]', 'Bagaimana pemeriksaan kemasan pada kartu sintetis?');
 await click('[name=send]');
 await wait("document.querySelector('#conversation')?.innerText.includes('Manual pelatihan uji')");
 await click('#attachToggle');
 await ev(`{const f=document.querySelector('[name=document]'), dt=new DataTransfer();dt.items.add(new File(['Latihan referensi file'], 'contoh.txt', {type:'text/plain'}));f.files=dt.files;f.dispatchEvent(new Event('change'));}`);
 await fill('#main [name=q]','Ringkas lampiran uji.');
 await click('[name=send]');
 await wait("document.querySelector('#conversation')?.innerText.includes('contoh.txt')");
 assert.match(modelCalls.at(-1).context,/Latihan referensi file/);
 const beforeCamera=modelCalls.length;
 await click('#cameraOpen');
 await wait("document.querySelector('#cameraPreview')?.videoWidth > 0");
 await ev("window.capturedTrack=document.querySelector('#cameraPreview').srcObject.getVideoTracks()[0]");
 await click('#cameraGrab');
 await wait("window.capturedTrack.readyState==='ended'");
 assert.equal(modelCalls.length,beforeCamera,'Mengambil gambar saja harus menunggu pengiriman oleh pengguna');
 await fill('#main [name=q]','Apa kondisi kemasan ini dan bagaimana cara memeriksanya sesuai kartu?');
 await click('[name=send]');
 await wait("document.querySelector('#conversation')?.innerText.toLowerCase().includes('abnormal')");
 assert.equal(modelCalls.at(-1)?.photo,true);
 await click('#conversation [data-doc]');
 await wait("document.querySelector('#main h1')?.textContent==='Manual pelatihan uji'");
 console.log('OK Chrome · AI chat, pengambilan foto melalui perangkat kamera uji, kirim foto dan tampilkan penilaian simulasi');
 if(!await ev("document.querySelector('.report-nav').open"))await click('.report-nav summary');
 await click('[data-area="Filling Machine"]');
 await wait("!!document.querySelector('[data-new=FILL_EVENT]')");
 assert.equal(await ev("!!document.querySelector('[data-new=PRODUCTION_TOTAL]')"),false);
 await click('[data-new=FILL_VOLUME]');
 await fill('[data-key=jaw_1]','0');
 await wait("document.querySelector('.volume-matrix')?.innerText.includes('○')");
 await fill('[data-key=jaw_2]','-4');
 await wait("document.querySelector('.volume-matrix caption')?.innerText.startsWith('Jaw 2')");
 await fill('.matrix-jaw','1');
 assert.equal(await ev("document.querySelector('.volume-matrix tbody tr:nth-child(5)').innerText.includes('○')"),true);
 await fill('[data-meta=unit]','FM-BROWSER');
 await click('#save');
 await wait("document.querySelector('.modebar')?.innerText.includes('Versi 1')");
 await click('[data-group=hour] summary');
 await wait("document.querySelector('.volume-matrix')?.innerText.includes('×')");
 await click('[data-area="Filling Machine"]');
 await click('[data-new=FILL_EVENT]');
 await fill('[data-meta=unit]','FM-REVIEW');
 await fill('[data-meta=lot]','LOT-FOREMAN');
 const technical='[data-group=technical]';
 for(const [key,val] of Object.entries({Stop:'10:00',Start:'10:05',Code:'FM',Desc:'Jeda simulasi',class:'Unplanned'}))await fill(technical+' [data-key='+key+']',val);
 await click('#save');
 await click('[data-act=submit]');
 await click('dialog[open] [value=ok]');
 await wait("!!document.querySelector('.modebar .PENDING')");
 await openLogin('fm-browser');
 assert.equal(await ev("!!document.querySelector('#newRpt')"),false);
 if(!await ev("document.querySelector('.report-nav').open"))await click('.report-nav summary');
 await click('[data-area="Filling Machine"]');
 await wait("!!document.querySelector('[data-browse=FILL_EVENT]')");
 assert.equal(await ev("!!document.querySelector('[data-new]')"),false);
 await goMenu('dashboard');
 await click('#queue');
 await wait("document.querySelector('#matches')?.innerText.includes('LOT-FOREMAN')");
 await click('#matches [data-open]');
 await wait("!!document.querySelector('[data-act=approve]')");
 assert.equal(await ev("!!document.querySelector('#save')"),false);
 await click('[data-act=approve]');
 await click('dialog[open] [value=ok]');
 await wait("!!document.querySelector('.modebar .APPROVED')");
 console.log('OK Chrome · admin menautkan foreman, operator Filling mengirim kejadian, foreman hanya meninjau dan menyetujui');
 assert.deepEqual(errors,[]);
 await openLogin('op-baris');
 await wait("document.querySelector('#line select')?.value==='Filling 57'");
 if(!await ev("document.querySelector('.report-nav').open"))await click('.report-nav summary');
 await click('[data-area="Filling Machine"]');
 await wait("!!document.querySelector('[data-new=FILL_EVENT]')");
 assert.equal(await ev("!!document.querySelector('[data-new=STERILIZER_GEA]')"),false);
 await ev("{const s=document.querySelector('#line select');s.value='Filling 58';s.dispatchEvent(new Event('change'));}");
 await wait("!!document.querySelector('#queue') && document.querySelector('#line select')?.value==='Filling 58'");
 console.log('OK Chrome · admin mendaftarkan area dan line, login operator serta pemilihan line di tablet');
 console.log('OK Chrome · pengumuman admin tampil, operator belajar dan lulus kuis, AI Corner membuka rujukan manual');
}finally{sock?.close();chrome.kill();http.closeAllConnections();http.close();await f.close();await new Promise(r=>setTimeout(r,250));await fs.rm(tmp,{force:true,recursive:true}).catch(()=>{});}


import {fixture} from './fixture.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const f=await fixture();try{
 const a=await f.login('op-uji'), b=await f.login('op-lain');
 assert.equal((await f.post('live',{},a)).x.enabled,false);
 await f.db.exec("create schema realtime; create table realtime.messages(topic text,extension text,event text,data jsonb,private boolean); alter table realtime.messages enable row level security; create function realtime.topic() returns text language sql as $$select current_setting('satu.test_topic',true)$$; create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into realtime.messages values($3,'broadcast',$2,$1,$4)$$;");
 await f.db.exec(await readFile(new URL('../supabase/04_dashboard_live.sql',import.meta.url),'utf8'));
 const c=(await f.post('live',{},a)).x;assert.equal(c.enabled,true);assert.ok(c.topic.startsWith('satu-'));assert.ok(!JSON.stringify(c).includes(f.env.SUPABASE_SECRET_KEY));
 const can=async t=>(await f.db.query('select public.satu_may_listen($1) v',[t])).rows[0].v;
 assert.equal(await can(c.topic),true);assert.equal(await can('satu-'+crypto.randomUUID()),false);
 const t=f.mod.clock(),d={id:crypto.randomUUID(),op:crypto.randomUUID(),version:0,type:'FILL_EVENT',cook:0,doc:{meta:{date:t.day,shift:t.shift,unit:'Test'},sections:{}}};
 assert.equal((await f.post('save',d,b)).status,200);const {rows}=await f.db.query('select * from realtime.messages');
 assert.deepEqual(rows,[{topic:c.topic,extension:'broadcast',event:'report_changed',data:{},private:true}]);
 // A session watching two production lines receives a distinct topic for each.
 const admin=await f.login('adm-uji');
 const reviewer={name:'Pengawas Uji',employee:'spv-live',active:true,productionLines:['Unit A','Unit B'],workArea:'Filling - Packing',role:'pengawas',password:f.testPassword};
 assert.equal((await f.post('account',reviewer,admin)).status,200);
 const reviewerSession=await f.login(reviewer.employee);
 const topicA=(await f.post('live',{line:'Unit A'},reviewerSession)).x.topic;
 const topicB=(await f.post('live',{line:'Unit B'},reviewerSession)).x.topic;
 assert.notEqual(topicA,topicB);
 await f.post('account',{...reviewer,role:'operator',workArea:'Filling',employee:'op-live'},admin);
 const assigned=await f.login('op-live');
 const write=await f.post('save',{...d,id:crypto.randomUUID(),op:crypto.randomUUID(),line:'Unit A'},assigned);
 assert.equal(write.status,200);
 const topics=await f.db.query('select topic from realtime.messages where topic in ($1,$2)',[topicA,topicB]);
 assert.deepEqual(topics.rows,[{topic:topicA}]);
 await f.post('logout',{},reviewerSession);
 assert.equal(await can(topicA),false);assert.equal(await can(topicB),false);
 await f.post('logout',{},a);assert.equal(await can(c.topic),false);
 const src=await readFile(new URL('../pages/live.js',import.meta.url),'utf8');
 const {watchDashboard}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 let socket,sent,refreshed=0,live=false;globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};globalThis.WebSocket=class{static OPEN=1;constructor(url){socket=this;this.url=url;this.readyState=1;}send(m){sent=JSON.parse(m);}close(){this.readyState=3;}};
 const stop=watchDashboard(async()=>c,()=>{refreshed++;},x=>{live=x;});await new Promise(r=>setTimeout(r,1));socket.onopen();
 assert.equal(sent.event,'phx_join');assert.equal(sent.payload.config.private,true);socket.onmessage({data:JSON.stringify({topic:sent.topic,ref:'1',event:'phx_reply',payload:{status:'ok'}})});assert.equal(live,true);
 socket.onmessage({data:JSON.stringify({topic:sent.topic,event:'broadcast',payload:{event:'report_changed',payload:{}}})});await new Promise(r=>setTimeout(r,450));assert.equal(refreshed,2);
 socket.onmessage({data:JSON.stringify({topic:sent.topic,event:'broadcast',payload:{event:'report_changed'}})});
 stop();await new Promise(r=>setTimeout(r,400));assert.equal(refreshed,2);
 console.log('OK kanal privat, sinyal kosong, pencabutan sesi dan penyegaran dashboard (layanan Realtime disimulasikan).');
}finally{await f.close();}


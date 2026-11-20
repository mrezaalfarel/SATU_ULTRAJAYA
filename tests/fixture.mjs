// Local adapter for Supabase HTTP contracts. PostgreSQL itself runs via PGlite.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function fixture(){
 const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz default now());');
 await db.exec(await fs.readFile(path.join(root,'supabase/01_install.sql'),'utf8'));
 const cat=await fs.readFile(path.join(root,'src/catalog.json'),'utf8'), assets={};
 for(const file of await fs.readdir(path.join(root,'src/private'))){const b=await fs.readFile(path.join(root,'src/private',file));assets[file]=[file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/webp',b.toString('base64')];}
 const code='const CATALOG='+cat+'; const PRIVATE_ART='+JSON.stringify(assets)+';\n'+(await fs.readFile(path.join(root,'src/validation.js'),'utf8'))+'\n'+(await fs.readFile(path.join(root,'src/worker.js'),'utf8'))+'\nexport {validateReport,geofence,clock,handle};';
 const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const env={SUPABASE_URL:'https://db.test',SUPABASE_SECRET_KEY:'synthetic-secret',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',PILOT_LINE:'Line Uji',SITE_LAT:'0',SITE_LON:'0',SITE_RADIUS_M:'250',GPS_MAX_ACCURACY_M:'50'};
 const accounts=new Map(),blobs=new Map(),ids={};const testPassword='Khusus-pengujian-01';
 const profiles=[
  ['op-uji','operator','Filling'], ['op-lain','operator','Filling'],
  ['op-proses','operator','Proses'], ['op-steril','operator','Sterilizer - Aseptic Tank'],
  ['op-packing','operator','Packing'], ['spv-uji','pengawas','Filling - Packing'],
  ['spv-proses','pengawas','Proses'], ['spv-steril','pengawas','InProses'],
  ['adm-uji','admin'], ['mgmt-uji','management'], ['qc-uji','qc']
 ];
 for(const [username,role,area] of profiles){
  const id=crypto.randomUUID();ids[username]=id;const email=username+'@login.satu.invalid';accounts.set(email,{id,password:testPassword});await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);
  await db.query('insert into satu.people(id,employee,name,role,work_area,production_lines) values($1,$2,$2,$3,$4,$5)',[id,username,role,area??null,area?[env.PILOT_LINE]:null]);
 }
 const rawFetch=globalThis.fetch;
 globalThis.fetch=async(url,init={})=>{
  if(!String(url).startsWith(env.SUPABASE_URL))return rawFetch(url,init);const u=new URL(url),payload=typeof init.body==='string'?JSON.parse(init.body):{};
  if(u.pathname==='/rest/v1/rpc/satu_gateway'){try{const {rows}=await db.query('select public.satu_gateway($1,$2,$3) as v',[payload.p_action,JSON.stringify(payload.p_data),payload.p_session]);return Response.json(rows[0].v);}catch(e){return Response.json({message:e.message},{status:400});}}
  if(u.pathname==='/auth/v1/token'){const a=accounts.get(payload.email);return a&&a.password===payload.password?Response.json({user:{id:a.id}}):Response.json({error:'credentials'},{status:400});}
  if(u.pathname==='/auth/v1/admin/users'&&init.method==='POST'){
   if(accounts.has(payload.email))return Response.json({},{status:422});
   const id=crypto.randomUUID();accounts.set(payload.email,{id,password:payload.password});await db.query('insert into auth.users(id,email) values($1,$2)',[id,payload.email]);return Response.json({id});}
  if(u.pathname.startsWith('/auth/v1/admin/users/')&&init.method==='PUT'){const a=[...accounts.values()].find(a=>a.id===u.pathname.split('/').pop());if(!a)return Response.json({},{status:404});a.password=payload.password;return Response.json({id:a.id});}
  if(u.pathname.startsWith('/storage/v1/object/')){const key=u.pathname.split('satu-private/')[1];if(init.method==='POST'){blobs.set(key,init.body);return Response.json({});}return blobs.has(key)?new Response(blobs.get(key),{headers:{'Content-Type':'application/pdf'}}):new Response('',{status:404});}
  return Response.json({},{status:404});
 };
 const dir=path.join(root,'pages');env.ASSETS={fetch:async req=>{
  const u=new URL(req.url);const f=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!/^[a-zA-Z0-9_.-]+$/.test(f))return new Response('',{status:404});
  try{return new Response(await fs.readFile(path.join(dir,f)),{headers:{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':'text/html'}});}catch{return new Response('',{status:404});}
 }};
 const url='https://pilot.test',geo={lat:0,lon:0,accuracy:4};const post=async(name,payload={},cookie='',origin=url)=>{
  const req=new Request(url+'/api/'+name,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},body:JSON.stringify(payload)});const res=await mod.default.fetch(req,env);
  return {status:res.status,x:await res.json(),cookie:res.headers.get('Set-Cookie')?.split(';')[0]};};
 const login=async(employee)=>{const v=await post('login',{employee,password:testPassword,geo});if(!v.cookie)throw Error('Login failed '+JSON.stringify(v));return v.cookie;};
 return {db,ids,mod,env,post,login,geo,testPassword,worker:mod.default,catalog:JSON.parse(cat),close:async()=>{globalThis.fetch=rawFetch;await db.close();}};
}


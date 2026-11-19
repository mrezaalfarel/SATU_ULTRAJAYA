import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir=new URL('../',import.meta.url),read=p=>fs.readFile(new URL(p,dir),'utf8');
const lib=await import(new URL('src/private/layouts.js',dir));const cat=JSON.parse(await read('src/catalog.json'));
const run=new Function('esc','statusNames','layouts', (await read('pages/print.js')).split('export async function printReport')[0].replace(/^import.*$/m,'').replace("const layouts=await import('/private/layouts.js'),data=legacy(d,def);","const data=legacy(d,def);")+';return original;')(String,{},lib);
for(const d of cat.slice(0,8)){
 const row={id:'test',type:d.id,cook:d.id==='PROCESS_MILK'?2:0,day:'2026-11-18',line:'Line sintetis',shift:'1',unit:'1',status:'APPROVED',version:3,doc:{meta:{date:'2026-11-18',unit:'1',stlz:'Q',at:'1'},sections:{}}};
 for(const g of d.sections){if(g.fields.length)row.doc.sections[g.id]={1:{[g.fields[0].key]:'123'}};}
 const html=await run(row,d);assert.ok(html.includes('<svg'));assert.ok(html.includes('<img'));assert.ok(html.includes('/private/'));assert.ok(!/undefined|NaN/.test(html),d.id);assert.ok(!html.includes('data:image/'));
 const m=html.match(/src="\/private\/([^"]+)"/);assert.ok((await fs.stat(new URL('src/private/'+m[1],dir))).size>1000);
 console.log('OK',d.id,d.formNo);
}


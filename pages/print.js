import {esc,statusNames} from '/app.js';
const ordered=rows=>Object.entries(rows||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
function legacy(d,def){
 const m=d.doc.meta,s={};for(const g of def.sections){
  const list=d.doc.sections[g.id]||{};
  if(def.id==='PROCESS_MILK'&&g.id!=='info'){
   const a=[];for(const [slot,row] of ordered(list)){a[(d.cook-1)*(g.id==='pasteur'?4:1)+Number(slot)-1]=row;}s[g.id]=a;
  }else if(g.kind==='fields')s[g.id]=list['1']||{};
  else if(g.kind==='hourly')s[g.id]=Object.fromEntries(ordered(list).map(([n,v])=>[String(Number(n)%24),v]));
  else{s[g.id]=[];for(const [slot,row] of ordered(list))s[g.id][Number(slot)-1]=row;s[g.id]=Array.from(s[g.id],x=>x||{});}
 }return {meta:m,sections:s,status:d.status};
}
async function original(d,def){
 if(!['PROCESS_MILK','PROCESS_CIP_PAST','STERILIZER_GEA','ASEPTIC_GEA','ASEPTIC_CIP','PACKING_CBP','PACKING_STRAW','SUPERVISOR_DAILY'].includes(d.type))return '';
 const layouts=await import('/private/layouts.js'),data=legacy(d,def);
 if(d.type==='PROCESS_MILK')return layouts.suMilkPdfRecap(def,data);
 if(d.type==='PROCESS_CIP_PAST')return layouts.suCipPdfRecap(data);
 if(['PACKING_CBP','PACKING_STRAW','SUPERVISOR_DAILY'].includes(d.type))return layouts.su69ExactPreview(d.type,data);
 const s=data.sections,meta=data.meta,k=d.day+'#'+d.shift,operator=meta.operator||s.shift?.['operator_shift_'+d.shift]||d.author||'';
 const hours=Object.fromEntries(ordered(d.doc.sections.hour).map(([n,r])=>[n.padStart(2,'0'),r]));
 const state={date:d.day,stlz:meta.stlz||d.unit,at:meta.at||'',reviews:[{key:k,status:d.status}],shiftNames:[{key:k,shift:d.shift,operator}],
 doc:{preheat:s.preheat||[],hour:hours,wip:s.wip||[],cip:s.cip_stlz||s.cip_summary||[],owners:{hour:Object.fromEntries(Object.keys(hours).map(n=>[n,k]))},notes:{entries:{}}},
 cip:{date:d.day,values:{...s.cip,...s.notes}}};
 const fields=id=>(def.sections.find(g=>g.id===(id==='cip'?(d.type==='STERILIZER_GEA'?'cip_stlz':'cip_summary'):id))?.fields||[]).filter(f=>id!=='hour'||f.key!=='pengawas');
 const marks=d.type==='STERILIZER_GEA'?layouts.sterilizerInk(state,fields):layouts.asepticInk(state,fields,d.type==='ASEPTIC_CIP');
 return `<div class="original-page"><img alt="Formulir ${esc(def.formNo)}" src="/private/${d.type}.webp"><svg viewBox="0 0 792 612" xmlns="http://www.w3.org/2000/svg">${marks}</svg></div>`;
}
export async function printReport(r,def){
 const root=document.querySelector('#printRoot'),art=await original(r,def),meta=r.doc.meta;
 const head=`<h1>${esc(def.title)}</h1><p>${esc(def.formNo)} · ${esc(r.day)} · ${esc(r.line)} / ${esc(r.unit)} · Shift ${esc(r.shift)}${r.cook?' · Masakan '+r.cook:''} · ${esc(statusNames[r.status])} · v${r.version}</p>`;
 const body=def.sections.map(g=>{
  const rows=ordered(r.doc.sections[g.id]);if(!rows.length)return '';
  return '<h3>'+esc(g.title)+'</h3><table><thead><tr><th>Isian</th><th>Parameter</th><th>Nilai</th></tr></thead><tbody>'+rows.map(([n,row])=>g.fields.filter(f=>row[f.key]!=null&&row[f.key]!=='').map(f=>'<tr><td>'+esc(g.kind==='hourly'?'Jam '+String(Number(n)%24).padStart(2,'0'):n)+'</td><td>'+esc(f.label)+'</td><td>'+esc(row[f.key])+' '+esc(f.unit||'')+'</td></tr>').join('')).join('')+'</tbody></table>';}).join('');
 root.innerHTML=(art?'<section class="paper"><p class="print-meta">'+esc(r.line+' · '+r.day+' · Shift '+r.shift+' · '+statusNames[r.status]+' · v'+r.version)+'</p>'+art+'</section>':'')+head+
 '<p class="print-meta">ID '+esc(r.id)+' · Pencatat '+esc(r.author||'—')+' · Peninjau '+esc(r.reviewer||'—')+'</p><h2>Data tersimpan</h2><p>'+def.meta.filter(f=>meta[f.key]).map(f=>esc(f.label)+' · '+esc(meta[f.key])).join(' &nbsp; | &nbsp; ')+'</p>'+body;
 try{await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode()));const clear=()=>root.replaceChildren();window.addEventListener('afterprint',clear,{once:true});window.print();}
 catch{root.replaceChildren();throw Error('Latar cetak belum termuat. Periksa sesi dan koneksi lalu coba lagi.');}
}


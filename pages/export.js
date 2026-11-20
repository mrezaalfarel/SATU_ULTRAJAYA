// The column order is stable across forms, including historical parameters.
const columns = ['ID','Versi','Tanggal','Shift','Line','Unit','Jenis laporan','Formulir','Masakan',
 'SKU','Batch','Lot','Status','Terakhir diubah','Bagian','Posisi','Kode parameter','Parameter','Nilai','Satuan'];

function encodeRow(values) {
 return values.map(value=>{
  let text=String(value??'');
  // Keep numeric measurements numeric while escaping expressions in spreadsheet software.
  if (/^[\s\uFEFF]*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 }).join(',')+'\r\n';
}

export function reportCsv(report,definition) {
 const base=[report.id,report.version,report.day,report.shift,report.line,report.unit,report.type,
  definition?.title??report.type,report.cook||'',report.sku,report.batch,report.lot,report.status,report.updated_at];
 const rows=[];
 function fields(section,slot,values,labels) {
  for (const [key,value] of Object.entries(values??{})) {
   const field=labels?.find(item=>item.key===key);
   rows.push(encodeRow([...base,section,slot,key,field?.label??key,value,field?.unit]));
  }
 }
 fields('Identitas','',report.doc.meta,definition?.meta);
 for (const [sectionId,slots] of Object.entries(report.doc.sections??{})) {
  const section=definition?.sections.find(item=>item.id===sectionId);
  for (const [slot,values] of Object.entries(slots)) fields(section?.title??sectionId,slot,values,section?.fields);
 }
 return rows.length?rows.join(''):encodeRow([...base,'','','','','','']);
}

export async function exportFilteredReports({filters,api,catalog,active,progress}) {
 const filename='SATU-'+filters.from+'_'+filters.to+'.csv';
 let stream,completed=false;
 const chunks=[];
 let bytes=0,count=0;
 const encoder=new TextEncoder();
 async function write(text) {
  const data=encoder.encode(text);
  if(stream){await stream.write(data);return;}
  bytes+=data.length;
  if(bytes>64*1024*1024)throw Error('Ekspor melebihi kapasitas unduh tab. Persempit tanggal atau gunakan Chrome desktop untuk menyimpan langsung ke file.');
  chunks.push(data);
 }
 async function checkActive() {
  if(!active())throw new DOMException('Ekspor dibatalkan.','AbortError');
 }
 try{
  if(typeof window.showSaveFilePicker==='function'){
   try{
    const file=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'CSV',accept:{'text/csv':['.csv']}}]});
    stream=await file.createWritable();
   }catch(err){if(err.name!=='SecurityError')throw err;}
  }
  await write('\uFEFF'+encodeRow(columns));
  let cursor={};
  for(;;){
   await checkActive();
   const page=await api('list',{...filters,...cursor,export:true});
   await checkActive();
   for(const report of page.slice(0,10)){
    await write(reportCsv(report,catalog.find(d=>d.id===report.type)));
    count++;
   }
   progress(count);
   if(page.length<=10)break;
   const last=page[9];
   cursor={cursor_day:last.day,cursor_id:last.id};
  }
  await checkActive();
  if(stream)await stream.close();
  else{
   const url=URL.createObjectURL(new Blob(chunks,{type:'text/csv;charset=utf-8'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  completed=true;
  return count;
 }finally{if(stream&&!completed)await stream.abort().catch(()=>{});}
}

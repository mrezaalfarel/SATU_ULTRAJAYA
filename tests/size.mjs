// Local synthetic capacity sample. No cloud credentials, no data sent to a project.
import {fixture} from './fixture.mjs';
const f=await fixture();try{
 const {db,ids,catalog}=f,actor=ids['op-uji'];
 const fields=catalog.find(f=>f.id==='STERILIZER_GEA').sections.find(g=>g.id==='hour').fields.filter(f=>f.key!=='pengawas').slice(0,25);
 const hours={};for(let h=7;h<=14;h++)hours[h]=Object.fromEntries(fields.map((v,i)=>[v.key,v.type==='number'?String(10+i+h/10):v.options?.find(Boolean)||'UJI']));
 const begin=Date.now();
 await db.query(`insert into satu.reports(id,type,day,shift,line,unit,cook,product,sku,batch,lot,doc,terms,stats,status,version,owner_id,editor_id)
 select md5('test-satu-report-'||n)::uuid,'STERILIZER_GEA',date '2026-01-01'+(n%200),1,'Sintetis','Mesin-'||(n/200),0,'Uji','SKU-1','B-'||n,'L-'||n,
 jsonb_build_object('meta',jsonb_build_object('date',date '2026-01-01'+(n%200),'unit','Mesin-'||(n/200),'shift','1','stlz',substr('QRSTUNOPHIJKL',1+(n/200)%13,1),'at',(1+(n/200)/13)::text,'batch','B-'||n,'lot','L-'||n,'sku','SKU-1','product','Uji'),'sections',jsonb_build_object('hour',$2::jsonb)),
 array['b-'||n,'l-'||n,'sku-1','mesin-'||(n/200)],'{}','APPROVED',3,$1,$1 from generate_series(0,4999) n`,[actor,JSON.stringify(hours)]);
 console.error('5.000 dokumen masuk');
 await db.query("insert into satu.history(report_id,version,actor,action) select r.id,v,$1,case v when 1 then 'save' when 2 then 'submit' else 'approve' end from satu.reports r cross join generate_series(1,3) v",[actor]);
 await db.query("insert into satu.operations(op,actor,action,report_id,version) select md5(report_id::text||':'||version)::uuid,actor,action,report_id,version from satu.history");
 console.error('Riwayat dan indeks siap');await db.exec('analyze satu.reports');
 const actual=(await db.query("select count(*) as reports,sum((select sum((select count(*) from jsonb_object_keys(h.value))) from jsonb_each(r.doc#>'{sections,hour}') h)) values from satu.reports r")).rows[0];
 const size=(await db.query("select sum(pg_total_relation_size(c.oid)) bytes from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='satu' and c.relkind='r'")).rows[0].bytes;
 const plan=(await db.query("explain (analyze,buffers) select id from satu.reports where line='Sintetis' and status<>'ARCHIVED' and day between '2026-01-01' and '2026-12-31' and terms @> array['l-4001'] order by day desc,id desc limit 26")).rows;
 if(Number(actual.values)!==1000000)throw Error('Jumlah nilai yang dibaca kembali belum sesuai.');
 console.log(JSON.stringify({reports:Number(actual.reports),recordedValues:Number(actual.values),sampleSizeBytes:Number(size),elapsedMs:Date.now()-begin,traceQueryPlan:plan.map(x=>x['QUERY PLAN'])},null,2));
}finally{await f.close();}


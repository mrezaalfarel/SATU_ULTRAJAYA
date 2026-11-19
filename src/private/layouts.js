function suArtEsc(v){return String(v===null||v===undefined?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function suOriginalCell(x,y,value,maxWidth=82,options={}){
 if(value===undefined||value===null||String(value).trim()==='')return '';
 let str=String(value).trim().replace(/\r?\n/g,' '), size=options.size||7.1;
 const approx=str.length*size*.55;
 if(approx>maxWidth)size=Math.max(4.25,Math.min(size,maxWidth/(str.length*.54)));
 const xs=options.align==='left'?x-maxWidth/2+1.4:x;
 const anchor=options.align==='left'?'start':'middle';
 const fit=str.length*size*.54>maxWidth?` textLength="${Math.max(1,maxWidth-2).toFixed(2)}" lengthAdjust="spacingAndGlyphs"`:'';
 return `<text x="${xs.toFixed(2)}" y="${(y+size*.34).toFixed(2)}" fill="#111" font-family="Arial,Helvetica,sans-serif" font-size="${size.toFixed(2)}" text-anchor="${anchor}" font-weight="${options.bold?'700':'500'}"${fit}>${suArtEsc(str)}</text>`;
}
function suSourceReportLayer(type, marks){
 return `<div class="su-exact-scroller" role="region" aria-label="Pratinjau formulir asli ${type==='PROCESS_MILK'?'F.U.P.002':'F.U.U.CL.06'}" tabindex="0"><div class="su-exact-stage" data-su-original="${type}"><img alt="Latar formulir Controlled Copy asli; seluruh garis dan judul dipertahankan" src="${SU_ORIGINAL_ART[type]}"><svg class="su-exact-layer" viewBox="0 0 792 612" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${marks}</svg></div></div>`;
}
function suMilkPdfRecap(s,doc){
 const secs=doc.sections||{},vals=(sect,i,key)=>((secs[sect]||[])[i]||{})[key],show=(v)=>v==='OK'?'√':v==='TIDAK OK'?'×':v==='N/A'?'N/A':v;
 let z='';const put=(x,y,v,w=82,opts={})=>z+=suOriginalCell(x,y,v,w,opts);
 const date=doc.meta?.date||'';
 const formattedDate=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4):date;
 put(97,69,processDay(date),72);put(226,69,formattedDate,72);put(355,69,doc.meta?.unit,63);
 const leftX=[159,177,195,213],rightX=[441.5,539.5,637.3,732.5];
 const left=[
  ['checks_dump', ['corong_dumping_bersih','dust_collector_bersih','alat_bantu_bersih'],[98.7,110.3,122.1]],
  ['checks_process',['in_filter_bersih_dan_tidak_rusak_oprp','pressure_steam','suhu_ice_water_in','pressure_water','level_homo_oil_min_50','pressure_homo_oil','tidak_ada_jalur_pipa_bocor','area_dan_peralatan_bersih','filter_air_bersih_dan_tidak_rusak'],[145,168.3,180.2,191.7,203.3,214.9,226.6,238.1,249.6]],
  ['checks_material',['jenis_dan_quantity_sesuai_formula','material_sudah_release_qc','material_bersih_dan_tidak_rusak','material_tidak_expired'],[273.5,286,298.6,311]]
 ];
 left.forEach(([section,keys,ys])=>keys.forEach((k,j)=>leftX.forEach((x,i)=>put(x,ys[j],show(vals(section,i,k)),16,{size:6.1}))));
 const mixes=['recipe_fresh_milk_st_silo','volume_air_ke_mt_tahap_1','suhu_air_di_mt_saat_dumping_stabilizer','sirkulasi_stabilizer_dan_garam','volume_air_ke_mt_tahap_2','dumping_chocolate_powder_kopi','sirkulasi_coklat','suhu_air_di_mt_saat_dumping_smp_wmp','dumping_smp_wmp','volume_gula_cair_ke_mt','sirkulasi_after_mixing','suhu_akhir_di_mt_setelah_sirkulasi','tambahan_reproses','start_mixing','finish_mixing'];
 const mixY=[98.7,110.3,122.1,133.7,145.3,156.9,168.6,180.2,191.7,203.3,214.9,226.6,238.1,249.7,261];
 mixes.forEach((k,j)=>rightX.forEach((x,i)=>put(x,mixY[j],show(vals('mix',i,k)),92,{size:6.8})));
 const pats=[
  ['volume_air_dorongan_awal_ke_st_35_40',285.3],['suhu_inlet_product_dari_mt',297.5],['suhu_inlet_product_ke_homogenizer_p10',310.2],['__pressure_homo',322.6],
  ['suhu_pasteurisasi_oprp',335.1],['flow_rate_pasteurisasi',347.1],['suhu_outlet_produk_ke_st_silo',359],['masukkan_flavor_color_ke_bt_atau_st',371.0],
  ['volume_air_dorongan_akhir',382.2],['start_pasteurisasi',393.7],['finish_pasteurisasi',404.8]
 ];
 const pkeys=(s.sections||[]).find(x=>x.id==='pasteur')?.fields.map(x=>x.key)||[];
 pats.forEach(([k,y])=>{
  if(!pkeys.includes(k)&&k!=='__pressure_homo')return;
  rightX.forEach((cx,i)=>{
   const each=[0,1,2,3].map(j=>{
    const row=(secs.pasteur||[])[i*4+j]||{};
    let v=(k==='__pressure_homo')?[row.pressure_homogenizer_1st_stage,row.pressure_homogenizer_2nd_stage].filter(x=>x!==undefined&&x!==null&&String(x)!=='').join('/'):row[k];
    return v;
   });
   const vset=each.filter(v=>v!==undefined&&v!==null&&String(v)!=='');
   if([0,1,2,3,4,5,6].includes(pats.findIndex(p=>p[0]===k))){each.forEach((v,j)=>put(392.65+i*97.7+12.2+j*24.45,y,v,23,{size:5.2}));}
   else{const summary=vset.length?((new Set(vset.map(String)).size===1)?vset[0]:vset.map((v,j)=>String(v)).join(',')):'';put(cx,y,summary,90,{size:6.6});}
  });
 });
 const stkeys=['agitator_st_on_setelah_level_3000_l','volume_akhir_wip_di_st','lama_agitasi_wip_sebelum_ambil_sampel','waktu_ambil_sampel_lab_qc'];
 const stYs=[427.5,439,450.2,461.5];stkeys.forEach((k,j)=>rightX.forEach((x,i)=>put(x,stYs[j],show(vals('storage',i,k)),92,{size:6.7})));
 rightX.forEach((x,i)=>{
  const ad=(secs.adjust||[])[i]||{};
  const mat=[ad.tambahan_material,ad.jumlah_tambahan_material,ad.material_unit].filter(v=>v!==undefined&&v!==null&&String(v)!=='').join(' ');
  put(x,483.4,mat,92,{size:6.5});
  put(x,494.9,ad.volume_wip_st_setelah_adjustment,92);
  put(x,506,ad.approval_produk_oleh_qc,92);
 });
 const identity=[['cook_product',519.6],['cook_batch',532],['cook_lot',543.8],['cook_st',555.4],['cook_operator',567.1],['cook_supervisor',579.2]];
 identity.forEach(([k,y])=>rightX.forEach((x,i)=>put(x,y,vals('cook_ident',i,k),92,{size:6.3})));
 let notes=String((secs.info||{}).note||'').split(/\r?\n/g).flatMap(l=>l.match(/.{1,43}/g)||['']).slice(0,24);
 notes.forEach((v,i)=>put(118,337.5+i*8.3,v,202,{size:7,align:'left'}));
 return suSourceReportLayer('PROCESS_MILK',z);
}
function suCipPdfRecap(doc){
 let z='';const p=(x,y,v,w=38)=>z+=suOriginalCell(x,y,v,w,{size:6.6});
 const row=doc.sections?.cip||{};
 p(120,118,row.pasteurizer_line||doc.meta?.unit,57);
 const names=['date','produk_sebelum_cip','flow_produk_terakhir_sebelum_cip','pre_rinse','caustic_flow','caustic_waktu','caustic_suhu','caustic_conductivity','intermediate_rinse','acid_flow','acid_waktu','acid_suhu','acid_conductivity','final_rinse_waktu','final_rinse_conductivity','start_cip','stop_cip','operator','supervisor'];
 const xs=[41.9,84.8,127,166,204,243,281,320,354,390,430,468,506,546,588,631,672,714,753];
 names.forEach((k,i)=>{const d=doc.meta?.date||'';const fmt=/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):d;p(xs[i],167.5,k==='date'?fmt:row[k],i===1?38:(i===2?42:35));});
 return suSourceReportLayer('PROCESS_CIP_PAST',z);
}
function su69ExactPreview(type,data){
 if(!SU69_BG[type])return '';
 const safe=s=>String(s===undefined||s===null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const d=data||{},m=d.meta||{},s=d.sections||{};let marks=[];
 function val(v){if(v==='OK')return '✓';if(v==='TIDAK OK')return '×';return String(v===undefined||v===null?'':v)}
 function add(x,y,v,w=35,size=6,align='middle'){if(v===undefined||v===null||String(v)==='')return;marks.push(`<text x="${x}" y="${y}" fill="#123526" font-family="Arial,sans-serif" font-size="${size}" font-weight="600" text-anchor="${align}" textLength="${String(val(v)).length>Math.max(4,w/size*1.9)?w:''}" lengthAdjust="spacingAndGlyphs">${safe(val(v))}</text>`)}
 function dmy(v){const q=String(v||'').split('-');return q.length===3?q[2]+'/'+q[1]+'/'+q[0]:v}
 const dow=(()=>{const q=String(m.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(q))return '';const a=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];return a[new Date(q+'T12:00:00').getDay()]})();
 if(type==='PACKING_CBP'){
   add(90,121,dow,75,7);add(233,121,dmy(m.date),78,7);add(391,121,m.unit,75,7);
   const p=s.production||{};[['mulai_produksi',148],['selesai_produksi',161],['jenis_produk',173],['no_pb_production_batch',185]].forEach(([k,y])=>add(137,y,p[k],65,6));
   const complete=s.completeness||{};[1,2,3].forEach((i)=>add(135+35*(i-1),213,val(complete['completeness_shift_'+i]||''),29,7));
   const machine=(s.machine||[])[0]||{},glue=(s.glue||[])[0]||{};
   ['jam_pengecekan','compressor_air','alarm_lamp_test','lubrication_level','suction_cup_function','silinder_roller_tidak_ada_yang_macet','sensor_belt_distribution_machine_normal','sensor_conveyor_normal','conveyor_bersih_tidak_tajam'].forEach((k,i)=>add(175,249+i*12,machine[k],46,6));
   ['jam_pengecekan','suhu_hot_melt_tank','pressure_hot_melt_tank','suhu_hot_melt_hose','pressure_hot_melt_hose','nozzle_hot_melt_tidak_kotor_block','posisi_tembakan_hotmelt_sesuai'].forEach((k,i)=>add(175,380+i*12,glue[k],46,6));
   const f=s.hour||{};let keys=['top_flap_sealing_box','left_flap_sealing_box','right_flap_sealing_box','box_design_printing_color','kode_box_sesuai_dan_terbaca','suhu_hotmelt_tank','dented_product_in_box','warna_lakban_unilever'];
   Object.keys(f).forEach(hr=>{const j=Number(hr);if(j<0||j>23)return;keys.forEach((k,i)=>add(331+j*18.7,145+i*12.2,f[hr][k],17,6));});
   (s.box||[]).slice(0,18).forEach((r,i)=>{const yy=292+i*13.4;['time','nama_produk','lot_pm','mfg_date','qty'].forEach((k,j)=>add([245,280,325,382,437][j],yy,r[k],38,5.6))});
   (s.event||[]).slice(0,18).forEach((r,i)=>{const yy=292+i*13.4;['stop','start','event_kejadian'].forEach((k,j)=>add([490,527,650][j],yy,r[k],j===2?155:36,5.7))});
   const si=s.shift||{};[1,2,3].forEach((i)=>{add(91+(i-1)*35,517,si['operator_shift_'+i],33,6);add(91+(i-1)*35,539,si['pengawas_shift_'+i],33,6)});
 }else if(type==='PACKING_STRAW'){
   add(94,111,dow,70,7);add(252,111,dmy(m.date),80,7);add(425,111,m.unit,70,7);
   const prep=s.preparation||[];prep.slice(0,3).forEach((r,i)=>{add(158+i*26,131,r.mulai_preheating,33,6);add(158+i*26,144,r.selesai_preheating,33,6)});
   const prod=s.production||{};[['jenis_produk',166],['volume',178],['mulai_produksi',190],['selesai_produksi',202],['tidak_ada_produk_lain_di_jalur',213]].forEach(([k,y])=>add(152,y,prod[k],70,6));
   const straw=(s.check_straw||[])[0]||{},conv=(s.check_conveyor||[])[0]||{},glue=(s.check_glue||[])[0]||{};
   ['jam_pengecekan','compressor_air','alarm_lamp_test','lubrication_level','semua_silinder_roller'].forEach((k,i)=>add(174,254+i*13,straw[k],58,6));
   ['sensor_conveyor_bekerja','lubrikasi_conveyor','conveyor_bersih','accumulator_conveyor','accumulator_sensor'].forEach((k,i)=>add(174,323+i*12.2,conv[k],58,6));
   ['jam_pengecekan','suhu_tank','pressure_tank','suhu_hose','pressure_hose','gun_pressure','nozzle','posisi_hotmelt'].forEach((k,i)=>add(174,407+i*12.4,glue[k],58,6));
   const hours=s.hour||{},keys=['kode_pak','print_kode','pak_tanpa_goresan','pak_bersih','design_pak','posisi_straw','lem_straw'];
   Object.keys(hours).forEach(hr=>{const h=Number(hr),top=h<12,x=337+(h%12)*36.1,y=129;keys.forEach((k,j)=>add(x,(top?y:241)+j*12.5,hours[hr][k],36,6))});
   (s.material||[]).slice(0,15).forEach((r,i)=>{const j=['Straw 1','Straw 2','Straw 3','Straw 4','Lem'].indexOf(r.material||'');if(j<0)return;const x=311+j*86,yy=372+Math.min(i,4)*13;add(x,yy,r.waktu,33,5.7);add(x+25,yy,r.lot_internal,39,5.5);add(x+53,yy,r.no_pallet,29,5.3)});
   const si=s.shift||{};[1,2,3].forEach(i=>{add(105+i*38,502,si['operator_shift_'+i],34,6);add(105+i*38,526,si['pengawas_shift_'+i],34,6)});
   const notes=String(si.note||'').split(/\n/).slice(0,9);notes.forEach((line,i)=>add(260,433+i*10,line.slice(0,65),180,6,'start'));
 }else if(type==='SUPERVISOR_DAILY'){
   add(131,114,m.stlz||m.unit,75,8,'start');
   (s.entries||[]).slice(0,27).forEach((r,i)=>{const x=[41,82,150,212,260,318,359,401,444,482,515,553,589,660],y=157+i*12.8;
    const vals=[dmy(r.row_date),r.product_name,r.no_lot_wip,r.no_batch_wip,r.no_st,r.volume,r.product_to_at_start,r.product_to_at_stop,r.filling_machine_start,r.filling_machine_stop,r.cip_sterilizer_start,r.cip_sterilizer_stop,r.cip_aseptic_tank_start,r.cip_aseptic_tank_stop];vals.forEach((v,j)=>add(x[j],y,v,j<6?43:26,5.7)) ; add(723,y,r.note,94,5.5);
   });
   const si=s.sign||{};[1,2,3].forEach(i=>add(149,520+i*18,si['pengawas_shift_'+i],62,7));
   String(si.catatan||si.note||'').split(/\n/).slice(0,5).forEach((str,i)=>add(244,538+i*10,str,340,6,'start'));
 }
 if(data.status!=='APPROVED'){
   marks.push('<text x="396" y="309" text-anchor="middle" transform="rotate(-28 396 309)" fill="#b33b39" fill-opacity="0.20" font-size="62" font-weight="800" font-family="Arial">DRAFT</text>');
 }
 const svg=`<svg class="su69-ink" viewBox="0 0 792 612" xmlns="http://www.w3.org/2000/svg">${marks.join('')}</svg>`;
 return `<div class="su69-original-scroller"><div class="su69-paper"><img class="su69-bg" alt="Format resmi formulir ${safe(type)}" src="${SU69_BG[type]}">${svg}</div></div>`;
}
export function sterilizerInk(S,fields){
function marks(){let out='';function t(x,y,text,w=22,size=5.2,align='middle'){
 const s=String(text===undefined||text===null?'':text).trim();if(!s)return;
 const fs=Math.max(3,Math.min(size,w/(s.length*.54)));out+=`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-weight="600" fill="#132d22" font-size="${fs.toFixed(2)}" text-anchor="${align}">${esc(s)}</text>`;
 }
 const c=v=>v==='OK'?'√':v==='TIDAK OK'?'×':v;
 t(101,68,S.date,92,7);t(341,68,S.stlz,55,7);t(447,68,S.at,55,7);
 const hourRows=fields('hour'),xHour=Array.from({length:24},(_,i)=>172+(i<15?26.5*i:26.5*14+25.25*(i-14)));
 hourRows.forEach((f,i)=>{if(i>=33)return;const y=93.8+i*10.91;for(let h=1;h<=24;h++){const key=String(h).padStart(2,'0'),value=S.doc.hour?.[key]?.[f.key];t(xHour[h-1],y,c(value),24,5.3);}});
 const px=[109,138], py=[478,489,500,511,522,533,544,555,566,577];fields('preheat').forEach((f,i)=>{if(i<10)px.forEach((x,j)=>t(x,py[i],c(S.doc.preheat?.[j]?.[f.key]),25,5.5));});
 const wx=[174,201,238,268,306,340,374];fields('wip').forEach(()=>{});(S.doc.wip||[]).slice(0,3).forEach((row,i)=>fields('wip').forEach((f,j)=>t(wx[j],497+i*10,row[f.key],j===2?39:27,4.6)));
 const cx=[411,443,468,504,533,559,589,620,651,675,700,734,762];(S.doc.cip||[]).slice(0,3).forEach((row,i)=>fields('cip').forEach((f,j)=>t(cx[j],497+i*10,c(row[f.key]),j===0?28:24,4.1)));
 // Supervisor paraf is shown only after a valid approved shift, never fabricated from typed name.
 const statusMap=Object.fromEntries((S.reviews||[]).map(r=>[r.key,r.status]));
 for(let h=1;h<=24;h++){const k=String(h).padStart(2,'0'),owner=S.doc.owners?.hour?.[k];if(owner&&statusMap[owner]==='APPROVED')t(xHour[h-1],452,'✓',24,5.4);}
 for(const sh of (S.shiftNames||[])){const y=550+(Number(sh.shift)-1)*15.3;t(712,y,sh.operator,38,5);if(statusMap[sh.key]==='APPROVED')t(750,y,'✓',17,7);}
 const note=Object.entries(S.doc.notes?.entries||{}).map(([k,v])=>k+': '+v).join(' / ');note.slice(0,320).match(/.{1,79}/g)?.slice(0,4).forEach((line,i)=>t(397,542+i*10,line,300,5.3,'start'));
 return out;
}
return marks();}
export function asepticInk(S,fields,isCip){
function mark(x,y,v,width=35,size=6,anchor='middle'){if(v===null||v===undefined||String(v)==='')return '';const s=String(v==='OK'?'✓':v==='TIDAK OK'?'×':v),font=Math.max(3,Math.min(size,width/(s.length*.52)));return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${font}" fill="#193528" font-weight="600" text-anchor="${anchor}">${esc(s)}</text>`;}
function productionMarks(){let o='';o+=mark(98,84,new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date(S.date+'T12:00:00+07:00')),66,6);o+=mark(216,84,S.date,80,7);o+=mark(354,84,S.stlz,45,7);o+=mark(479,84,S.at,44,7);
 // Pdf F.U.F.040: 4 Preheating columns, 8 rows.
 const px=[82,113,148,180],pys=Array.from({length:8},(_,i)=>118+i*13.1);fields('preheat').forEach((f,i)=>{if(i<pys.length)px.forEach((x,j)=>{o+=mark(x,pys[i],S.doc.preheat?.[j]?.[f.key],26,5.8)})});
 // 19 measured rows; manual coordinate mapping on original Form F.U.F.040.
 const hx=Array.from({length:24},(_,i)=>326+i*19.65),hf=fields('hour');hf.forEach((f,i)=>{const y=119+i*13.09;for(let h=1;h<=24;h++){const key=String(h).padStart(2,'0');o+=mark(hx[h-1],y,S.doc.hour?.[key]?.[f.key],18.2,5.1)}});
 let statusMap=Object.fromEntries((S.reviews||[]).map(r=>[r.key,r.status]));for(let h=1;h<=24;h++){let k=String(h).padStart(2,'0'),owner=S.doc.owners?.hour?.[k];if(owner&&statusMap[owner]==='APPROVED')o+=mark(hx[h-1],375,'✓',17,6)}
 // WIP first 7 rows.
 const wpx=[218,266,310,366,417,465,503],wfields=fields('wip');(S.doc.wip||[]).slice(0,7).forEach((r,i)=>wfields.forEach((f,j)=>o+=mark(wpx[j],401+i*13.5,r[f.key],38,5)));
 // CIP summary first 7 rows.
 const cpx=[526,555,582,612,644,675,705,736,759,780],cf=fields('cip');(S.doc.cip||[]).slice(0,7).forEach((r,i)=>cf.forEach((f,j)=>o+=mark(cpx[j],401+i*13.5,r[f.key],24,4.1)));
 (S.shiftNames||[]).forEach(r=>{const y=488+(Number(r.shift)-1)*13;o+=mark(80,y,r.operator,72,5.3);if(statusMap[r.key]==='APPROVED')o+=mark(143,y,'✓',15,7)});
 return o;}
function cipMarks(){
 const v=S.cip.values||{};let out='';
 // F.U.U.CL.04: printed table is 20 columns. Additional pH and notes are retained.
 const entries=[
 [42,S.cip.date,51],[85,v.produk_sebelum_cip,39],[125,v.nama_alat_mesin,38],[164,v.cip_circuit,24],[196,v.pre_rinse,26],
 [229,v.caustic_flow,31],[266,v.caustic_waktu,37],[303,v.caustic_suhu,26],[351,v.caustic_konsentrasi,48],[386,v.intermediate_rinse,24],
 [421,v.acid_flow,31],[459,v.acid_waktu,37],[496,v.acid_suhu,30],[540,v.acid_konsentrasi,39],
 [592,v.final_rinse_waktu,32],[624,[v.final_rinse_conductivity,v.final_rinse_ph].filter(Boolean).join(' / '),43],
 [661,v.start_cip,28],[685,v.stop_cip,32],[716,v.operator,35],[755,v.supervisor,35]
 ];
 entries.forEach(([x,value,w])=>out+=mark(x,143,value,w,5.4));
 out+=mark(682,483,v.change_solution,84,6);
 const note=String(v.note||'').slice(0,110);out+=mark(653,505,note,204,5.3);
 return out;
}
return isCip?cipMarks():productionMarks();}

export {suMilkPdfRecap,suCipPdfRecap,su69ExactPreview};
const esc=suArtEsc;
const processDay=d=>new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date(d+'T12:00:00+07:00'));
const SU69_BG={"PACKING_CBP": "/private/PACKING_CBP.png", "PACKING_STRAW": "/private/PACKING_STRAW.png", "SUPERVISOR_DAILY": "/private/SUPERVISOR_DAILY.png"};
const SU_ORIGINAL_ART={"PROCESS_MILK": "/private/PROCESS_MILK.svg", "PROCESS_CIP_PAST": "/private/PROCESS_CIP_PAST.svg"};

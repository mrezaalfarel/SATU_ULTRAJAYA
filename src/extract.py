"""Regenerate the private form catalog and the eight original print overlays from the supplied GAS export."""
import ast
import base64
import html
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
out = root / 'src' / 'private'
out.mkdir(parents=True, exist_ok=True)
def read(n):
    return (source / n).read_text(encoding='utf-8')
def data(n, key):
    source_text = read(n)
    raw = re.search(r'const '+key+r'\s*=\s*Object\.freeze\(([\s\S]*?)\n[\]}]\);',source_text).group(0)
    raw = raw[raw.index('freeze(')+7:-2]
    raw = re.sub(r'(?m)^(\s*)([A-Z_]+):',r"\1'\2':",raw)
    return ast.literal_eval(re.sub(r'\b(true|false)\b', lambda m:m[0].title(),raw))
def field(k,l,t='text',**kwargs):
    return dict(key=k,label=l,type=t,**kwargs)
def section(key,title,kind,fields,**kw):
    return dict(id=key,title=title,kind=kind,fields=fields,**kw)
def option(k,l,opts,**kw):
    return field(k,l,'select',options=['']+opts,**kw)
def label_fields(file,prefix):
    s=read(file+'.html'); out=[]
    for tag in re.findall(r'<label\b[^>]*>[\s\S]*?</label>',s):
        el=re.search(r'<(select|input|textarea)\b([^>]+)',tag)
        if not el:continue
        attrs=el[2]; ident=re.search(r'\bid="([^"]+)"',attrs)
        if not ident or not ident[1].startswith(prefix):continue
        key=ident[1][len(prefix):].lstrip('_')
        label=html.unescape(' '.join(re.sub('<[^>]+>',' ',tag[:el.start()]).split())).strip(' *')
        opts=[html.unescape(v) for v in re.findall(r'<option[^>]*\bvalue="([^"]*)"[^>]*>',tag)]
        attrtype=re.search(r'type="([^"]+)"',attrs)
        typ=el[1] if el[1]!='input' else attrtype[1] if attrtype else 'text'
        if 'inputmode="decimal"' in attrs:typ='number'
        f=field(key,label,typ)
        if typ=='select':
            if not any(opts):opts=['']+[html.unescape(re.sub('<[^>]+>','',x).strip()) for x in re.findall(r'<option(?:\s[^>]*)?>(.*?)</option>',tag) if not x.strip().startswith('Pilih')]
            f['options']=opts
        if '*' in tag[:el.start()]:f['required']=True
        if 'readonly' in attrs or key.endswith('Duration') or key=='Total':f['computed']=True
        out.append(f)
    return out
raw=read('SUReportsCatalog.gs')
catalog=json.JSONDecoder().raw_decode(raw[raw.index('['):])[0]
forms={x['id']:x for x in catalog}
milk=forms['PROCESS_MILK']; groups={s['id']:s for s in milk['sections']}
extra_raw=re.search(r'const extra=(\[[\s\S]*?\n    \]);',read('SUProcessMilkConfig.html'))[1]
extra=ast.literal_eval(re.sub(r'\b(true|false)\b',lambda m:m[0].title(),extra_raw))
milk['sections'].insert(0,section('cook_ident','Identitas Produksi per Masakan','fields',[field(a,b,c,required=f) for a,b,c,d,e,f in extra]))
groups['checks_dump']['fields'].append(option('alat_bantu_bersih','Alat bantu (pisau, sikat, stick) bersih',['OK','TIDAK OK','N/A']))
# Each cook has its own approval, with four readings for pasteurization.
for g in milk['sections']:
    if g['kind']=='matrix':
        if g['id']=='pasteur':g['count']=4
        else:g['kind']='fields';g.pop('count',None)
for f in milk['meta']:
    if f['key']=='unit':f.update(type='select',label='Line Pasteurizer',options=['','1','2','10','11'])
for g in forms['ASEPTIC_GEA']['sections']:
    if g['id']=='preheat':g.update(kind='matrix',count=4)
service='FillingService.gs'; daily='FillingDailyV51.gs'
slots=data(daily,'FILLING_V51_SLOT_MASTER')
def filling(key,title,code,revision,sections):
    m=[field('date','Tanggal produksi','date',required=True),option('shift','Shift',['1','2','3'],required=True),field('unit','Nomor mesin',required=True),field('product','Produk'),field('sku','SKU'),field('batch','Batch'),field('lot','Lot'),field('operator','Nama operator'),field('supervisor','Nama pengawas')]
    r=dict(id=key,title=title,area='Filling',formNo=code,rev=revision,meta=m,sections=sections);catalog.append(r);return r
gs=[]
for key,items in slots.items():
    fs=[]
    for k,l,t,std,req,order in items:
        options={'MARK':['OK','TIDAK OK','N/A'],'SELECT_CIP':['FC','IC'],'SELECT_VALVE':['N','T'],'SELECT_CHEMICAL':['Caustic','Caustic Acid']}
        f=option(k,l,options[t]) if t in options else field(k,l,{'TIME':'time','NUMBER':'number'}.get(t,'text'))
        f.update(hint=std,required=req);fs.append(f)
    gs.append(section(key,dict(PREPARATION='Persiapan',PRODUCTION='Produksi',CIP_SUMMARY='Ringkasan CIP',MACHINE_CHECK='Pemeriksaan mesin')[key],'repeater',fs))
gs.append(section('maintenance','Perawatan harian','fields',[option(x[0],x[1],['OK','TIDAK OK','N/A'],hint=x[2]) for x in data(daily,'FILLING_V51_MAINTENANCE_MASTER')]))
gs.append(section('hour','Parameter per jam','hourly',[field(a,b,'number',unit=c.strip(),hint=f,required=g,lower=d,upper=e) for a,b,c,d,e,f,g,h in data(service,'FILLING_HOURLY_MASTER')]))
for n,title in [('paper','Penggunaan paper'),('strip','Penggunaan strip')]:
    gs.append(section(n,title,'repeater',[field('time','Waktu','time'),field('internal_lot','Lot internal'),field('reel','Nomor reel'),field('note','Catatan')]))
gs.append(section('foreman','Kontrol dua jam pengawas','repeater',[field('period','Periode pemeriksaan'),field('note','Catatan pengawas')],supervisor=True))
filling('FILL_PRODUCTION','Laporan Produksi Filling Machine','F.U.F.039','05',gs)
filling('FILL_VOLUME','Volume Control','F.U.F.024','2',[section('hour','Posisi 10 jaw per jam','hourly',[option('jaw_'+str(i),'Jaw '+str(i),[str(n) for n in range(-4,5)],required=True) for i in range(1,11)])])
filling('FILL_PACK','Pack Integrity','F.U.F.019.A','03',[section('inspection','Pengecekan kemasan','repeater',label_fields('FillingPackIntegrity','fillV62Pack')),section('equipment','Ketersediaan alat','fields',[option(a,b,['OK','TIDAK OK','N/A']) for a,b in data(daily,'FILLING_V51_PACK_EQUIPMENT')])])
codes=data(service,'FILLING_EVENT_CODES'); events=[]
for category,area,prefix,title in [('technical','TECHNICAL','fillV62Tech','Problem Technical'),('quality','QUALITY','fillV62Quality','Quality Issue')]:
    fs=label_fields('FillingEvent',prefix)
    for f in fs:
        if f['key']=='Code':f.update(type='select',options=['']+[x[1] for x in codes if x[0]==area],labels={x[1]:x[2] for x in codes if x[0]==area})
    fs.append(option('class','Jenis downtime',['Planned','Unplanned'],required=True))
    events.append(section(category,title,'repeater',fs))
events.append(section('short_stop','Short Stop Downtime (menit)','fields',[field(x[1],x[2],'number',min=0,max=1440) for x in codes if x[0]=='SHORT_STOP']))
filling('FILL_EVENT','Laporan Kejadian Produksi','F.U.G.001','5',events)
cip=label_fields('FillingCIP','fillV62Cip')
for f in cip:
    if f['key'].startswith(('Caustic','Acid')):f['label']=('Caustic' if f['key'].startswith('Caustic') else 'Acid')+' · '+f['label']
filling('FILL_CIP','CIP Filling Machine','F.U.F.013','5',[section('cip','Pelaksanaan CIP','repeater',cip)])
r=filling('PRODUCTION_TOTAL','Total Produksi','Rekap','',[section('quantities','Perolehan produksi (pak)','fields',[field(k,l,'integer',min=0,max=1000000000,required=True) for k,l in [('target','Target'),('actual','Aktual'),('good','Produk baik'),('reject','Reject')]]+[field('start','Mulai','time'),field('end','Selesai','time'),field('notes','Catatan','textarea')])]);r['area']='Rekap'
# Dedicated Sterilizer/AT screens in the source keep machine and shift identity outside the generic catalog.
for form_id in ('STERILIZER_GEA','ASEPTIC_GEA','ASEPTIC_CIP'):
    d=forms[form_id]
    if not any(f['key']=='stlz' for f in d['meta']):d['meta'].append(field('stlz','Nomor sterilizer'))
    for f in d['meta']:
        if f['key'] in ('stlz','at'):
            choices=list('QRSTUNOPHIJKL') if f['key']=='stlz' else [str(n) for n in [1,2,3,4,5,6,7,8,9,10,12,13,14]]
            f.update(type='select',options=['']+choices,required=True)
    if form_id!='ASEPTIC_CIP':
        d['meta'] += [field('operator','Nama operator shift',required=True),field('supervisor','Nama pengawas shift',required=True)]
        for g in d['sections']:
            if g['kind']=='hourly':
                for f in g['fields']:
                    if f['key']=='pengawas':f.update(computed=True,hint='Persetujuan dicatat dari akun pengawas.')
for g in next(r for r in catalog if r['id']=='FILL_PRODUCTION')['sections']:
    if g['id']=='hour':
        for f in g['fields']:
            if f['key'] in ['TUBE_SPRINKLER','FFU_FLUSHING']:f.update(type='select',options=['','V','X','='],labels={'V':'OK','X':'Tidak OK','=':'Catatan'})
for d in catalog:
    for g in d['sections']:
        if d['id'] in ('FILL_PRODUCTION','FILL_PACK') and g['id'] in ('equipment','maintenance'):
            g['dailyLock']=True
            for f in g['fields']:f.update(options=['','V','X'],labels={'V':'Selesai / tersedia','X':'Tidak selesai / tidak tersedia'},required=True)
    for f in d['meta']:
        if f['key'] in ('date','unit','shift'):f['required']=True
    if not any(f['key']=='sku' for f in d['meta']):d['meta'].append(field('sku','SKU'))
    for g in d['sections']:
        for f in g['fields']:
            if f['type']=='check' and not f.get('options'):f['options']=['','OK','TIDAK OK','N/A']
(root/'src/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
# Only extract paper art and pure coordinate renderers. Never deploy Apps Script HTML or credentials.
def art(key,encoded,ext):
    (out/(key+'.'+ext)).write_bytes(base64.b64decode(encoded,validate=True))
def frag(n,first,last):return '\n'.join(read(n+'.html').splitlines()[first-1:last])
milk_art=read('SUReportsApp.html')
at_art=read('SUAtApp.html')
for key,src,var in [('PROCESS_MILK',milk_art,'PROCESS_MILK'),('PROCESS_CIP_PAST',milk_art,'PROCESS_CIP_PAST'),('ASEPTIC_GEA',at_art,'BG_MAIN'),('ASEPTIC_CIP',at_art,'BG_CIP'),('STERILIZER_GEA',read('SUStlzApp.html'),'ART')]:
    m=re.search(var+r"\s*[:=]\s*'data:image/([\w+]+);base64,([^']+)'",src);art(key,m[2],m[1].split('+')[0])
pack_art=json.loads(re.search(r'const SU69_BG=(\{.*?\});',read('SUPackingExactPrint.html'))[1])
for k,v in pack_art.items():art(k,v,'png')
code=frag('SUReportsApp',302,374)+'\n'+frag('SUPackingExactPrint',5,51).replace('data:image/png;base64,${SU69_BG[type]}','${SU69_BG[type]}').replace("typeof S==='undefined'||!S.record||!S.record[type]||S.record[type].status!=='APPROVED'","data.status!=='APPROVED'")+'\n'
code+='export function sterilizerInk(S,fields){\n'+frag('SUStlzApp',114,131)+'\nreturn marks();}\n'
code+='export function asepticInk(S,fields,isCip){\n'+frag('SUAtApp',97,124)+'\nreturn isCip?cipMarks():productionMarks();}\n'
code+="\nexport {suMilkPdfRecap,suCipPdfRecap,su69ExactPreview};\n"
code+="const esc=suArtEsc;\nconst processDay=d=>new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date(d+'T12:00:00+07:00'));\n"
for var,keys in [('SU69_BG',list(pack_art)),('SU_ORIGINAL_ART',['PROCESS_MILK','PROCESS_CIP_PAST'])]:
    code+='const '+var+'='+json.dumps({k:'/private/'+next(out.glob(k+'.*')).name for k in keys})+';\n'
(out/'layouts.js').write_text(code)
print(len(catalog),'forms;',sum(len(d['sections']) for d in catalog),'sections;',sum(len(d['meta'])+sum(len(g['fields']) for g in d['sections']) for d in catalog),'field definitions')


-- SATU ULTRAJAYA / Cloudflare pilot. Run in the Supabase SQL Editor as postgres.
begin;
create schema if not exists satu;
revoke all on schema satu from public, anon, authenticated;
create table if not exists satu.people (
 id uuid primary key references auth.users(id), employee text not null unique,
 name text not null check (length(name) between 1 and 100),
 role text not null check (role in ('admin','operator','pengawas','qc','management','qa','ci')),
 active boolean not null default true
);
create table if not exists satu.sessions (
 digest text primary key, person uuid not null references satu.people(id),
 expires_at timestamptz not null
);
alter table satu.sessions add column if not exists live_topic text not null default gen_random_uuid()::text;
alter table satu.sessions add column if not exists live_line text;
alter table satu.sessions add column if not exists listen_until timestamptz;
create unique index if not exists session_topic on satu.sessions(live_topic);
create index if not exists session_watchers on satu.sessions(live_line,listen_until);
create index if not exists session_person on satu.sessions(person);
create index if not exists session_expiry on satu.sessions(expires_at);
create table if not exists satu.throttle (bucket text primary key, since timestamptz not null, hits integer not null);
create index if not exists throttle_since on satu.throttle(since);
create table if not exists satu.reports (
 id uuid primary key, type text not null, day date not null, shift smallint not null check(shift between 1 and 3),
 line text not null, unit text not null, cook smallint not null default 0 check(cook between 0 and 4),
 product text not null default '', sku text not null default '', batch text not null default '', lot text not null default '',
 doc jsonb not null, terms text[] not null, stats jsonb not null default '{}',
 status text not null check(status in ('DRAFT','PENDING','APPROVED','REVISION','ARCHIVED')),
 version integer not null, owner_id uuid not null references satu.people, editor_id uuid not null references satu.people,
 reviewer_id uuid references satu.people, review_note text not null default '', updated_at timestamptz not null default now()
);
create unique index if not exists milk_identity on satu.reports(day,line,lower(unit),cook) where type='PROCESS_MILK' and status<>'ARCHIVED';
create unique index if not exists shift_identity on satu.reports(day,line,lower(unit),shift,type) where type not in ('PROCESS_MILK','PRODUCTION_TOTAL','FILL_CIP','ASEPTIC_CIP','PROCESS_CIP_PAST','STERILIZER_GEA','ASEPTIC_GEA') and status<>'ARCHIVED';
create unique index if not exists sterile_identity on satu.reports(day,line,shift,type,(doc#>>'{meta,stlz}'),(doc#>>'{meta,at}')) where type in ('STERILIZER_GEA','ASEPTIC_GEA') and status<>'ARCHIVED';
create unique index if not exists total_identity on satu.reports(day,line,lower(unit),shift,lower(sku),lower(batch),lower(lot)) where type='PRODUCTION_TOTAL' and status<>'ARCHIVED';
create index if not exists rpt_calendar on satu.reports(line,day desc,id desc) where status<>'ARCHIVED';
create index if not exists rpt_status_calendar on satu.reports(line,status,day desc,id desc);
create index if not exists rpt_downtime_calendar on satu.reports(line,day desc,id desc) where type='FILL_EVENT' and status='APPROVED';
create index if not exists rpt_terms on satu.reports using gin(terms);
create unique index if not exists daily_equipment on satu.reports(line,day,lower(unit)) where type='FILL_PACK' and status<>'ARCHIVED' and (doc->'sections') ? 'equipment';
create unique index if not exists daily_maintenance on satu.reports(line,day,lower(unit)) where type='FILL_PRODUCTION' and status<>'ARCHIVED' and (doc->'sections') ? 'maintenance';
create table if not exists satu.history (
 seq bigint generated always as identity primary key, report_id uuid not null references satu.reports,
 version integer not null, actor uuid not null references satu.people, action text not null, at timestamptz not null default now(),
 prior jsonb, note text not null default '', unique(report_id,version)
);
create index if not exists history_editors on satu.history(report_id,actor,action);
create table if not exists satu.operations (
 op uuid primary key, actor uuid not null references satu.people, action text not null, report_id uuid not null, version integer not null, created_at timestamptz not null default now()
);
create table if not exists satu.notices (
 id uuid primary key default gen_random_uuid(), title text not null, body text not null, active boolean not null default true,
 author uuid not null references satu.people, created_at timestamptz not null default now()
);
create table if not exists satu.modules (
 id uuid primary key default gen_random_uuid(), title text not null, category text not null, body text not null,
 revision text not null, active boolean not null default true, manual boolean not null default false, questions jsonb not null default '[]',
 attachment text, author uuid not null references satu.people, updated_at timestamptz not null default now(),
 search tsvector generated always as (to_tsvector('simple',coalesce(title,'')||' '||coalesce(body,''))) stored
);
create index if not exists module_search on satu.modules using gin(search);
create table if not exists satu.learning (
 person uuid not null references satu.people, module uuid not null references satu.modules, seconds integer not null default 0,
 visits integer not null default 0, last_seen timestamptz not null default now(), completed boolean not null default false,
 score integer, attempts integer not null default 0, primary key(person,module)
);
create or replace function satu.reset_changed_module() returns trigger language plpgsql set search_path='' as $$
begin
 update satu.learning set completed=false, score=null where module=new.id;
 return new;
end$$;
drop trigger if exists satu_module_changed on satu.modules;
create trigger satu_module_changed after update of questions,revision on satu.modules
 for each row when (old.questions is distinct from new.questions or old.revision is distinct from new.revision)
 execute function satu.reset_changed_module();

create table if not exists satu.management_log (
 seq bigint generated always as identity primary key, actor uuid not null references satu.people, action text not null,
 target text not null, at timestamptz not null default now()
);
-- Protect tables even if schema is later exposed by mistake.
do $$declare n text; begin
 foreach n in array array['people','sessions','throttle','reports','history','operations','notices','modules','learning','management_log'] loop
  execute format('alter table satu.%I enable row level security',n);
 end loop;
end$$;
revoke all on all tables in schema satu from public, anon, authenticated;
-- Existing accounts retain the deployment's PILOT_LINE until an admin assigns lines.
alter table satu.people add column if not exists production_lines text[];

create or replace function satu.valid_lines(lines text[]) returns boolean
language sql immutable set search_path='' as $$
 select lines is null or (
  cardinality(lines) between 1 and 40 and array_ndims(lines)=1 and array_lower(lines,1)=1
  and not exists(select 1 from unnest(lines) code where code is null or length(code) not between 1 and 80
                 or code<>trim(code) or code ~ '[,[:cntrl:]]')
  and (select count(distinct code) from unnest(lines) code)=cardinality(lines)
 )
$$;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='satu.people'::regclass and conname='satu_valid_lines') then
  alter table satu.people add constraint satu_valid_lines check (satu.valid_lines(production_lines));
 end if;
end$$;

-- Each browser session gets a different private channel for each line it watches.
create table if not exists satu.line_watchers (
 session_digest text not null references satu.sessions(digest) on delete cascade,
 line text not null, topic uuid not null default gen_random_uuid() unique, listen_until timestamptz not null,
 primary key(session_digest,line)
);
alter table satu.line_watchers enable row level security;
revoke all on satu.line_watchers from public, anon, authenticated;
create index if not exists line_watchers_active on satu.line_watchers(line,listen_until);

create or replace function satu.clear_changed_line_access() returns trigger
language plpgsql set search_path='' as $$
begin
 delete from satu.sessions where person=new.id;
 return new;
end$$;
drop trigger if exists satu_assignment_changed on satu.people;
create trigger satu_assignment_changed after update of production_lines on satu.people
for each row when (old.production_lines is distinct from new.production_lines)
execute function satu.clear_changed_line_access();

alter table satu.people add column if not exists work_area text;
create or replace function satu.form_allowed(p satu.people, form_type text)
returns boolean language sql immutable set search_path='' as $$
 select p.role <> 'operator' or p.work_area is null or form_type='PRODUCTION_TOTAL'
        or coalesce(p.work_area = (case form_type
when 'PROCESS_MILK' then 'Proses'
when 'PROCESS_CIP_PAST' then 'Proses'
when 'STERILIZER_GEA' then 'Sterilizer'
when 'ASEPTIC_GEA' then 'Aseptic Tank'
when 'ASEPTIC_CIP' then 'Aseptic Tank'
when 'PACKING_CBP' then 'Packing'
when 'SUPERVISOR_DAILY' then 'Supervisor'
when 'PACKING_STRAW' then 'Packing'
when 'FILL_PRODUCTION' then 'Filling'
when 'FILL_VOLUME' then 'Filling'
when 'FILL_PACK' then 'Filling'
when 'FILL_EVENT' then 'Filling'
when 'FILL_CIP' then 'Filling'
when 'PRODUCTION_TOTAL' then 'Rekap'
        else null end),false)
$$;

create or replace function satu.person_view(p satu.people) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'employee',p.employee,'role',p.role,'active',p.active,'workArea',p.work_area)
$$;
create or replace function satu.card(r satu.reports) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',r.id,'type',r.type,'day',r.day,'shift',r.shift,'unit',r.unit,'line',r.line,'cook',r.cook,'status',r.status,
 'product',r.product,'sku',r.sku,'batch',r.batch,'lot',r.lot,'version',r.version,'updated_at',r.updated_at,'owner_id',r.owner_id,'editor_id',r.editor_id,'review_note',r.review_note)
$$;
create or replace function satu.report_op(a text,d jsonb,p satu.people) returns jsonb language plpgsql set search_path='' as $$
declare r satu.reports; old_doc jsonb; ident uuid:=(d->>'id')::uuid; opid uuid:=(d->>'op')::uuid;
 x satu.operations; is_reviewer boolean:=p.role in ('admin','management','pengawas'); note text:=left(coalesce(d->>'note',''),800);
 m jsonb:=d#>'{doc,meta}'; newstatus text; v integer:=coalesce((d->>'version')::integer,-1); exists_row boolean;
begin
 if opid is null or ident is null or v<0 then raise exception 'INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(opid::text,0));
 select * into x from satu.operations where op=opid;
 if found then
  if x.actor<>p.id or x.action<>a or x.report_id<>ident then raise exception 'CONFLICT'; end if;
  if not exists(select 1 from satu.reports where id=ident and line=d->>'line' and satu.form_allowed(p,type)) then raise exception 'MISSING'; end if;
  return jsonb_build_object('id',ident,'version',x.version,'replayed',true);
 end if;
 select * into r from satu.reports where id=ident for update; exists_row:=found;
 if exists_row and (r.line<>d->>'line' or not satu.form_allowed(p,r.type)) then raise exception 'MISSING'; end if;
 if (exists_row and r.version<>v) or (not exists_row and v<>0) then raise exception 'CONFLICT'; end if;
 if a in ('save','submit') and coalesce(r.type,d->>'type')='SUPERVISOR_DAILY' and not is_reviewer then raise exception 'DENIED'; end if;
 if a='save' then
  if not satu.form_allowed(p,d->>'type') then raise exception 'DENIED'; end if;
  if p.role not in ('operator','pengawas','qc','qa','admin','management','ci') then raise exception 'DENIED'; end if;
  if exists_row and (r.status not in ('DRAFT','REVISION') or (r.owner_id<>p.id and not is_reviewer)) then raise exception 'DENIED'; end if;
  if exists_row and (r.type<>d->>'type' or r.day<>(m->>'date')::date or r.shift<>(m->>'shift')::int or r.unit<>m->>'unit' or r.cook<>(d->>'cook')::int) then raise exception 'IDENTITY'; end if;
  if exists_row and r.type in ('STERILIZER_GEA','ASEPTIC_GEA','ASEPTIC_CIP') and (
     (r.doc#>>'{meta,stlz}') is distinct from (m->>'stlz') or (r.doc#>>'{meta,at}') is distinct from (m->>'at')
     or (r.doc#>>'{meta,operator}') is distinct from (m->>'operator') or (r.doc#>>'{meta,supervisor}') is distinct from (m->>'supervisor')) then raise exception 'IDENTITY'; end if;
  if d->>'type'='PROCESS_MILK' and (d->>'cook')::int>1 and not exists(select 1 from satu.reports s where s.type='PROCESS_MILK' and s.line=d->>'line' and s.day=(m->>'date')::date and lower(s.unit)=lower(m->>'unit') and s.cook=(d->>'cook')::int-1 and s.status='APPROVED') then raise exception 'PREVIOUS_COOK'; end if;
  if exists_row then
   old_doc:=r.doc;
   update satu.reports set doc=d->'doc', terms=array(select jsonb_array_elements_text(d->'terms')),stats=d->'stats',product=m->>'product',sku=m->>'sku',batch=m->>'batch',lot=m->>'lot',
    version=version+1,editor_id=p.id,updated_at=now() where id=ident returning * into r;
  else
   insert into satu.reports(id,type,day,shift,line,unit,cook,product,sku,batch,lot,doc,terms,stats,status,version,owner_id,editor_id)
   values(ident,d->>'type',(m->>'date')::date,(m->>'shift')::int,d->>'line',m->>'unit',(d->>'cook')::int,m->>'product',m->>'sku',m->>'batch',m->>'lot',
    d->'doc',array(select jsonb_array_elements_text(d->'terms')),d->'stats','DRAFT',1,p.id,p.id) returning * into r;
  end if;
 else
  if not exists_row then raise exception 'MISSING'; end if;
  if a='submit' and r.status in ('DRAFT','REVISION') and (r.owner_id=p.id or is_reviewer) then newstatus:='PENDING';
  elsif a in ('approve','return') and r.status='PENDING' and is_reviewer then
   if exists(select 1 from satu.history h where h.report_id=ident and h.actor=p.id and h.action in ('save','submit')) then raise exception 'SELF_REVIEW'; end if;
   if a='return' and trim(note)='' then raise exception 'NOTE_REQUIRED'; end if;
   newstatus:=case a when 'approve' then 'APPROVED' else 'REVISION' end;
  elsif a='archive' and r.status in ('DRAFT','REVISION') and (r.owner_id=p.id or p.role='admin') then
   if trim(note)='' then raise exception 'NOTE_REQUIRED'; end if;newstatus:='ARCHIVED';
  else raise exception 'DENIED'; end if;
  update satu.reports set status=newstatus,version=version+1,updated_at=now(),
   reviewer_id=case when a in ('approve','return') then p.id else reviewer_id end,
   review_note=case when a in ('approve','return','archive') then note else review_note end where id=ident returning * into r;
 end if;
 insert into satu.history(report_id,version,actor,action,prior,note) values(ident,r.version,p.id,a,old_doc,note);
 insert into satu.operations(op,actor,action,report_id,version) values(opid,p.id,a,ident,r.version);
 return jsonb_build_object('id',ident,'version',r.version);
exception when unique_violation then raise exception 'DUPLICATE';
end$$;

create or replace function satu.read_reports(a text,d jsonb,p satu.people) returns jsonb language plpgsql set search_path='' as $$
declare r satu.reports; result jsonb; q text:=lower(trim(coalesce(d->>'q',''))); since date:=(d->>'from')::date; until_day date:=(d->>'to')::date; raw_status text:=nullif(d->>'status',''); k date:=(d->>'cursor_day')::date; k_id uuid:=(d->>'cursor_id')::uuid;
begin
 if a='detail' then
  select * into r from satu.reports where id=(d->>'id')::uuid and line=d->>'line' and satu.form_allowed(p,type) and (status<>'ARCHIVED' or p.role='admin');
  if not found then raise exception 'MISSING'; end if;
  return satu.card(r)||jsonb_build_object('doc',r.doc,'author',(select name from satu.people where id=r.owner_id),'reviewer',(select name from satu.people where id=r.reviewer_id),'history',
   (select coalesce(jsonb_agg(to_jsonb(h) order by version desc),'[]') from (select v.version,v.action,v.at,n.name,v.note from satu.history v join satu.people n on n.id=v.actor where v.report_id=r.id order by version desc limit 30) h),
   'can_review', r.status='PENDING' and p.role in ('admin','pengawas','management') and not exists (
    select 1 from satu.history h where h.report_id=r.id and h.actor=p.id and h.action in ('save','submit')
   ));
 end if;
 if since is null or until_day is null or until_day<since or until_day-since>366 then raise exception 'DATE_RANGE'; end if;
 if a='downtime' then
  select coalesce(jsonb_agg(satu.card(page.report) || jsonb_build_object(
   'planned',coalesce((page.report).stats->'planned','0'::jsonb),
   'unplanned',coalesce((page.report).stats->'unplanned','0'::jsonb),
   'issues',coalesce((page.report).stats->'issues','{}'::jsonb)
  ) order by (page.report).day desc,(page.report).id desc),'[]'::jsonb) into result
  from (select t as report from satu.reports t where t.line=d->>'line' and satu.form_allowed(p,t.type) and t.type='FILL_EVENT'
   and t.status='APPROVED' and t.day between since and until_day
   and (k is null or (t.day,t.id)<(k,k_id)) order by t.day desc,t.id desc limit 26) page;
  return result;
 end if;
 if a='list' then
  select coalesce(jsonb_agg(satu.card(z.r) order by (z.r).day desc,(z.r).id desc),'[]') into result from
  (select t as r from satu.reports t where t.line=d->>'line' and satu.form_allowed(p,t.type) and t.day between since and until_day and (t.status<>'ARCHIVED' or (p.role='admin' and raw_status='ARCHIVED'))
   and (raw_status is null or t.status=raw_status) and (nullif(d->>'type','') is null or t.type=d->>'type') and (q='' or t.terms @> array[q])
   and (k is null or (t.day,t.id)<(k,k_id)) order by t.day desc,t.id desc limit 26) z;
  return result;
 end if;
 with relevant as materialized(select day,status,stats from satu.reports where line=d->>'line' and satu.form_allowed(p,type) and day between since and until_day and status<>'ARCHIVED'),
 released as (select day,stats from relevant where status='APPROVED'),
 days as (select day,sum(coalesce((stats->>'good')::bigint,0)) good,sum(coalesce((stats->>'reject')::bigint,0)) reject from released group by day),
 issues as (select x.key,sum(x.value::int) n from released cross join lateral jsonb_each_text(coalesce(stats->'issues','{}')) x group by x.key order by n desc,x.key limit 5)
 select jsonb_build_object('reports',(select count(*) from relevant),'pending',(select count(*) from relevant where status='PENDING'),
 'good',coalesce(sum((stats->>'good')::bigint),0),'actual',coalesce(sum((stats->>'actual')::bigint),0),'target',coalesce(sum((stats->>'target')::bigint),0),'reject',coalesce(sum((stats->>'reject')::bigint),0),
 'planned',coalesce(sum((stats->>'planned')::numeric),0),'unplanned',coalesce(sum((stats->>'unplanned')::numeric),0),'issues',(select coalesce(jsonb_agg(to_jsonb(i) order by i.n desc,i.key),'[]') from issues i),
 'days',(select coalesce(jsonb_agg(to_jsonb(j) order by j.day),'[]') from days j)) into result from released;
 return result;
end$$;


create or replace function satu.support(a text,d jsonb,p satu.people) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; item satu.modules; ident uuid; usr satu.people; rankrow satu.learning; q jsonb; ix integer; marks integer:=0; n integer;
begin
 if a='auth_lookup' then
  if p.role<>'admin' then raise exception 'DENIED'; end if;
  return (select jsonb_build_object('id',u.id,'linked',exists(select 1 from satu.people sp where sp.id=u.id)) from auth.users u where u.email=(d->>'employee')||'@login.satu.invalid');
 elsif a='notices' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (select id,title,body,active,created_at from satu.notices where active or p.role in ('admin','management') order by created_at desc limit 40) x);
 elsif a='notice_save' then
  if p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  insert into satu.notices(id,title,body,active,author) values(coalesce((d->>'id')::uuid,gen_random_uuid()),d->>'title',d->>'body',(d->>'active')::boolean,p.id)
  on conflict(id) do update set title=excluded.title,body=excluded.body,active=excluded.active returning id into ident;
 elsif a='people' then
  if p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  return (select coalesce(jsonb_agg(satu.person_view(x.p)||jsonb_build_object('productionLines',(x.p).production_lines) order by (x.p).employee),'[]') from
   (select z as p from satu.people z where (d->>'after' is null or z.employee>d->>'after') order by z.employee limit 51) x);
 elsif a in ('profile_write','revoke_user') then
  if p.role<>'admin' then raise exception 'DENIED'; end if;
  ident:=(d->>'id')::uuid;
  if a='profile_write' then
   perform pg_advisory_xact_lock(hashtext('satu.people'));
   select * into usr from satu.people where id=ident for update;
   if found and usr.role='admin' and ((d->>'role')<>'admin' or not (d->>'active')::boolean) and usr.active
    and not exists(select 1 from satu.people z where z.role='admin' and z.active and z.id<>ident) then raise exception 'LAST_ADMIN'; end if;
   if not exists(select 1 from auth.users where id=ident and email=(d->>'employee')||'@login.satu.invalid') then raise exception 'IDENTITY'; end if;
   insert into satu.people(id,employee,name,role,active) values(ident,d->>'employee',d->>'name',d->>'role',(d->>'active')::boolean)
   on conflict(id) do update set name=excluded.name,role=excluded.role,active=excluded.active;
   if d ? 'workArea' then
    update satu.people set work_area=d->>'workArea' where id=ident;
   end if;
   if d ? 'productionLines' then
    update satu.people set production_lines=case when jsonb_typeof(d->'productionLines')='array'
      then array(select jsonb_array_elements_text(d->'productionLines')) else null end where id=ident;
   end if;
  elsif not exists(select 1 from satu.people where id=ident) then raise exception 'MISSING'; end if;
  delete from satu.sessions where person=ident;
 elsif a='leaderboard' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.seconds desc,x.name),'[]') from
   (select u.name,sum(l.seconds) seconds,sum(l.visits) visits,count(*) filter(where l.completed) completed from satu.learning l join satu.people u on u.id=l.person where u.active group by u.id,u.name order by seconds desc,u.name limit 10) x);
 elsif a='modules' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.title,x.id),'[]') from
   (select m.id,m.title,m.category,m.revision,m.active,m.manual,m.attachment is not null as has_file,l.seconds,l.completed,l.score from satu.modules m left join satu.learning l on l.module=m.id and l.person=p.id
    where (m.active or p.role in ('admin','management')) and (nullif(d->>'after','') is null or (m.title,m.id)>(d->>'after',(d->>'after_id')::uuid)) order by m.title,m.id limit 51) x);
 elsif a='manual_search' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.rank desc,x.title),'[]') from (select m.id,m.title,m.revision,ts_headline('simple',m.body,t.q,'StartSel=, StopSel=, MaxWords=55, MinWords=20, MaxFragments=3') excerpt, ts_rank(m.search,t.q) rank
   from satu.modules m cross join lateral (select to_tsquery('simple',coalesce(string_agg(quote_literal(word),' | '),'')) q from unnest(tsvector_to_array(to_tsvector('simple',d->>'q'))) as w(word) where length(word)>1 and word not in ('apa','apakah','bagaimana','cara','saya','kita','yang','dengan','pada','untuk','dan','di','ke','dari','ini','itu','berapa','mengenai','tolong')) t where m.active and m.manual and m.search @@ t.q order by rank desc,m.title limit 5) x);
 elsif a='module_save' then
  if p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  ident:=(d->>'id')::uuid;
  insert into satu.modules(id,title,category,body,revision,active,manual,questions,attachment,author) values(ident,d->>'title',d->>'category',d->>'body',d->>'revision',(d->>'active')::boolean,(d->>'manual')::boolean,d->'questions',nullif(d->>'attachment',''),p.id)
   on conflict(id) do update set title=excluded.title,category=excluded.category,body=excluded.body,revision=excluded.revision,active=excluded.active,manual=excluded.manual,questions=excluded.questions,attachment=excluded.attachment,updated_at=now();
 elsif a in ('module','visit','heartbeat','finish','quiz') then
  select * into item from satu.modules where id=(d->>'id')::uuid and (active or p.role in ('admin','management')) for share;
  if not found then raise exception 'MISSING'; end if;
  if a='module' then
   return jsonb_build_object('id',item.id,'title',item.title,'category',item.category,'body',item.body,'revision',item.revision,'active',item.active,'manual',item.manual,'attachment',item.attachment,'questions',
    case when d->>'edit'='true' and p.role in ('admin','management') then item.questions else (select coalesce(jsonb_agg(x-'correct' order by ord),'[]') from jsonb_array_elements(item.questions) with ordinality as t(x,ord)) end);
  end if;
  if not item.active then raise exception 'DENIED'; end if;
  if a='visit' then
   insert into satu.learning(person,module,visits) values(p.id,item.id,1) on conflict(person,module) do update set visits=satu.learning.visits+1,last_seen=now();
  else
   select * into rankrow from satu.learning where person=p.id and module=item.id for update;
   if not found then raise exception 'MISSING'; end if;
   if a='heartbeat' then
    update satu.learning set seconds=seconds+greatest(0,least(40,floor(extract(epoch from (now()-last_seen)))::int)),last_seen=now() where person=p.id and module=item.id;
   elsif a='finish' then
    if jsonb_array_length(item.questions)>0 and coalesce(rankrow.score,0)<70 then raise exception 'QUIZ_REQUIRED'; end if;
    update satu.learning set completed=true where person=p.id and module=item.id;
   else
    n:=jsonb_array_length(item.questions);if n=0 or jsonb_array_length(d->'answers')<>n then raise exception 'INPUT'; end if;
    for ix in 0..n-1 loop q:=item.questions->ix;if q->>'correct'=d->'answers'->>ix then marks:=marks+1;end if;end loop;
    marks:=round(100.0*marks/n);
    update satu.learning set score=greatest(coalesce(score,0),marks),attempts=attempts+1 where person=p.id and module=item.id;
    return jsonb_build_object('score',marks,'passed',marks>=70);
   end if;
  end if;return jsonb_build_object('ok',true);
 else raise exception 'INPUT'; end if;
 insert into satu.management_log(actor,action,target) values(p.id,a,ident::text);
 return jsonb_build_object('id',ident);
end$$;

create or replace function public.satu_gateway(p_action text,p_data jsonb,p_session text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p satu.people; n int; v timestamptz; selected_line text; fallback_line text;
begin
 if p_action='throttle' then
  insert into satu.throttle(bucket,since,hits) values(p_data->>'bucket',now(),1) on conflict(bucket) do update set
   hits=case when satu.throttle.since<now()-interval '15 min' then 1 else satu.throttle.hits+1 end,
   since=case when satu.throttle.since<now()-interval '15 min' then now() else satu.throttle.since end returning hits,since into n,v;
  -- Never roll back the counter when denying a request.
  if random()<0.015 then delete from satu.throttle where since<now()-interval '1 day';delete from satu.sessions where expires_at<now();end if;
  return jsonb_build_object('ok',n<=(p_data->>'limit')::int,'since',v);
 elsif p_action='start' then
  select * into p from satu.people where id=(p_data->>'id')::uuid and active;
  if not found then raise exception 'LOGIN_FAILED';end if;
  -- Successful sign-ins release their reservations, including on a shared factory IP.
  -- Match the time window so a slow sign-in cannot decrement the next window.
  update satu.throttle t set hits=greatest(0,t.hits-1)
  from jsonb_to_recordset(coalesce(p_data->'reservations','[]'::jsonb)) as r(bucket text,since timestamptz)
  where t.bucket=r.bucket and t.since=r.since;
  insert into satu.sessions(digest,person,expires_at) values(p_session,p.id,now()+interval '10 hours');
  return satu.person_view(p)||jsonb_build_object('productionLines',p.production_lines);
 end if;
 select u.* into p from satu.sessions s join satu.people u on u.id=s.person and u.active where s.digest=p_session and s.expires_at>now();
 if not found then raise exception 'SESSION'; end if;
 -- Older deployments supplied their server-configured default in "line".
 fallback_line:=coalesce(p_data->>'default_line',p_data->>'line');
 selected_line:=coalesce(p_data->>'line',p.production_lines[1],fallback_line);
 if selected_line is not null and not (selected_line=any(coalesce(p.production_lines,array[fallback_line]))) then
  raise exception 'DENIED';
 end if;
 p_data:=p_data||jsonb_build_object('line',selected_line);
 if p_action='me' then return satu.person_view(p)||jsonb_build_object('productionLines',p.production_lines);

 elsif p_action='prepare_edit' then
  return jsonb_build_object('person',satu.person_view(p),
   'replay',(select jsonb_build_object('id',x.report_id,'version',x.version,'replayed',true) from satu.operations x where x.op=(p_data->>'op')::uuid and x.actor=p.id and x.report_id=(p_data->>'id')::uuid and x.action=p_data->>'action'
    and exists(select 1 from satu.reports r where r.id=x.report_id and r.line=selected_line and satu.form_allowed(p,r.type))),
   'previous',(select jsonb_build_object('version',r.version,'type',r.type,'cook',r.cook,'doc',r.doc) from satu.reports r where (p_data->>'version')::int>0 and r.id=(p_data->>'id')::uuid and r.line=p_data->>'line' and satu.form_allowed(p,r.type) and r.status<>'ARCHIVED'));
 elsif p_action='live' then
  if to_regprocedure('satu.signal_reports()') is null then return jsonb_build_object('enabled',false);end if;
  insert into satu.line_watchers(session_digest,line,listen_until) values(p_session,selected_line,now()+interval '2 minutes')
   on conflict(session_digest,line) do update set listen_until=excluded.listen_until;
  return (select jsonb_build_object('enabled',true,'topic','satu-'||topic) from satu.line_watchers where session_digest=p_session and line=selected_line);
 elsif p_action='logout' then delete from satu.sessions where digest=p_session;return 'true';
 elsif p_action='logout_all' then delete from satu.sessions where person=p.id;return 'true';
 elsif p_action in ('save','submit','approve','return','archive') then return satu.report_op(p_action,p_data,p);
 elsif p_action in ('detail','list','dashboard','downtime') then return satu.read_reports(p_action,p_data,p);
 else return satu.support(p_action,p_data,p);end if;
end$$;
revoke all on all functions in schema satu from public,anon,authenticated;
revoke all on function public.satu_gateway(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.satu_gateway(text,jsonb,text) to service_role;
commit;


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
-- INSERT_CATALOG_AREAS
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


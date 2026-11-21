create or replace function satu.support(a text,d jsonb,p satu.people) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; item satu.modules; ident uuid; usr satu.people; next_area text; next_lines text[]; next_supervisor uuid; next_role text; next_active boolean; rankrow satu.learning; q jsonb; ix integer; marks integer:=0; n integer;
begin
 if a='auth_lookup' then
  if p.role<>'admin' then raise exception 'DENIED'; end if;
  return (select jsonb_build_object('id',u.id,'linked',exists(select 1 from satu.people sp where sp.id=u.id)) from auth.users u where u.email=(d->>'employee')||'@login.satu.invalid');
 elsif a='chat_save' then
  insert into satu.chat_turns(person,thread,question,answer) values(p.id,(d->>'thread')::uuid,d->>'q',d->'answer');
  return 'true';
 elsif a='chat_list' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.updated desc),'[]') from (
   select thread,(array_agg(question order by created_at,id))[1] title,max(created_at) updated
   from satu.chat_turns where person=p.id group by thread order by updated desc limit 100) x);
 elsif a='chat_read' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (
   select id,question,answer,created_at from satu.chat_turns where person=p.id and thread=(d->>'thread')::uuid
   order by created_at desc,id desc limit 100) x);
 elsif a in ('notices','notice_manage') then
  if a='notice_manage' and p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from
   (select id,title,body,active,created_at,starts,ends,target_role,target_area from satu.notices
    where a='notice_manage' or (active and (starts is null or starts<=(now() at time zone 'Asia/Jakarta')::date)
     and (ends is null or ends>=(now() at time zone 'Asia/Jakarta')::date)
     and (target_role is null or target_role=p.role) and (target_area is null or target_area=p.work_area))
    order by created_at desc limit 40) x);
 elsif a='notice_save' then
  if p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  insert into satu.notices(id,title,body,active,author,starts,ends,target_role,target_area)
  values(coalesce((d->>'id')::uuid,gen_random_uuid()),d->>'title',d->>'body',(d->>'active')::boolean,p.id,
    nullif(d->>'starts','')::date,nullif(d->>'ends','')::date,nullif(d->>'target_role',''),nullif(d->>'target_area',''))
  on conflict(id) do update set title=excluded.title,body=excluded.body,active=excluded.active,starts=excluded.starts,
   ends=excluded.ends,target_role=excluded.target_role,target_area=excluded.target_area returning id into ident;
 elsif a='supervisors' then
  if p.role<>'admin' then raise exception 'DENIED'; end if;
  return (select coalesce(jsonb_agg(satu.person_view(x.u)||jsonb_build_object('productionLines',(x.u).production_lines) order by (x.u).employee),'[]') from
    (select z as u from satu.people z where z.active and z.role='pengawas' and z.work_area=d->>'workArea'
     and z.production_lines is not null and (d->>'after' is null or z.employee>d->>'after') order by z.employee limit 51) x);
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
   next_role:=d->>'role';
   next_active:=(d->>'active')::boolean;
   next_area:=case when next_role in ('operator','pengawas','foreman') then
     case when d ? 'workArea' then d->>'workArea' when usr.role=next_role then usr.work_area end end;
   next_lines:=case when not d ? 'productionLines' then usr.production_lines
      when jsonb_typeof(d->'productionLines')='array' then array(select jsonb_array_elements_text(d->'productionLines')) end;
   next_supervisor:=case when next_role='foreman' then
     case when d ? 'supervisorId' then (d->>'supervisorId')::uuid else usr.supervisor_id end end;
   if next_active and next_role in ('operator','pengawas','foreman')
    and (cardinality(satu.assignment_forms(next_role,next_area))=0 or next_lines is null or not satu.valid_lines(next_lines)) then
    raise exception 'ASSIGNMENT_REQUIRED';
   end if;
   if next_role='foreman' and next_active then
    if next_supervisor=ident or not exists(select 1 from satu.people u where u.id=next_supervisor
      and u.active and u.role='pengawas' and u.work_area=next_area and u.production_lines @> next_lines) then
     raise exception 'SUPERVISOR_ASSIGNMENT';
    end if;
    if (select count(*) from satu.people where role='foreman' and active and supervisor_id=next_supervisor and id<>ident)>=4 then
     raise exception 'FOREMAN_LIMIT';
    end if;
   end if;
   if exists(select 1 from satu.people f where f.role='foreman' and f.active and f.supervisor_id=ident
      and (not next_active or next_role<>'pengawas' or f.work_area is distinct from next_area
           or not coalesce(next_lines @> f.production_lines,false))) then raise exception 'TEAM_ASSIGNED'; end if;
   insert into satu.people(id,employee,name,role,active,work_area,production_lines,supervisor_id)
    values(ident,d->>'employee',d->>'name',next_role,next_active,next_area,next_lines,next_supervisor)
    on conflict(id) do update set name=excluded.name,role=excluded.role,active=excluded.active,work_area=excluded.work_area,
       production_lines=excluded.production_lines,supervisor_id=excluded.supervisor_id;
  elsif not exists(select 1 from satu.people where id=ident) then raise exception 'MISSING'; end if;
  delete from satu.sessions where person=ident;
 elsif a='leaderboard' then
  return (with totals as (
   select u.id,u.name,sum(l.seconds) seconds,sum(l.visits) visits,
          coalesce(sum(l.score),0) points,count(l.score) quizzes,count(*) filter(where l.completed) completed
   from satu.learning l join satu.people u on u.id=l.person where u.active group by u.id,u.name
  ), ranked as (
   select *,case d->>'sort' when 'points' then points when 'visits' then visits else seconds end metric
   from totals where coalesce(d->>'sort','')<>'points' or quizzes>0
   order by metric desc,name,id limit 10
  ) select coalesce(jsonb_agg(to_jsonb(ranked)-'id'-'metric' order by metric desc,name,id),'[]') from ranked);
 elsif a='modules' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.title,x.id),'[]') from
   (select m.id,m.title,m.doc_no,m.doc_area,m.category,m.revision,m.active,m.manual,m.attachment is not null as has_file,l.seconds,l.completed,l.score from satu.modules m left join satu.learning l on l.module=m.id and l.person=p.id
    where (m.active or p.role in ('admin','management'))
      and (nullif(d->>'category','') is null or m.category=d->>'category'
        or (d->>'category'='Tutorial' and m.category in ('Book','Video'))
        or (d->>'category'='Mini Quiz' and jsonb_array_length(m.questions)>0))
      and (nullif(d->>'after','') is null or (m.title,m.id)>(d->>'after',(d->>'after_id')::uuid)) order by m.title,m.id limit 51) x);
 elsif a='manual_search' then
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.rank desc,x.title),'[]') from (select m.id,m.title,m.revision,ts_headline('simple',concat_ws(' ',m.doc_no,m.title,m.body,m.extracted),t.q,'StartSel=, StopSel=, MaxWords=55, MinWords=20, MaxFragments=3') excerpt, greatest(ts_rank(m.search,t.q),ts_rank(to_tsvector('simple',m.extracted),t.q)) rank
   from satu.modules m cross join lateral (select to_tsquery('simple',coalesce(string_agg(quote_literal(word),' | '),'')) q from unnest(tsvector_to_array(to_tsvector('simple',d->>'q'))) as w(word) where length(word)>1 and word not in ('apa','apakah','bagaimana','cara','saya','kita','yang','dengan','pada','untuk','dan','di','ke','dari','ini','itu','berapa','mengenai','tolong')) t where m.active and m.manual and (m.search @@ t.q or to_tsvector('simple',m.extracted) @@ t.q) order by rank desc,m.title limit 5) x);
 elsif a='module_save' then
  if p.role not in ('admin','management') then raise exception 'DENIED'; end if;
  ident:=(d->>'id')::uuid;
  insert into satu.modules(id,title,category,body,revision,active,manual,questions,attachment,author,doc_no,doc_area,extracted) values(ident,d->>'title',d->>'category',d->>'body',d->>'revision',(d->>'active')::boolean,(d->>'manual')::boolean,d->'questions',nullif(d->>'attachment',''),p.id,coalesce(d->>'doc_no',''),coalesce(d->>'doc_area','General'),coalesce(d->>'extracted',''))
   on conflict(id) do update set title=excluded.title,category=excluded.category,body=excluded.body,revision=excluded.revision,active=excluded.active,manual=excluded.manual,questions=excluded.questions,attachment=excluded.attachment,extracted=case when d ? 'extracted' or excluded.attachment is distinct from satu.modules.attachment then excluded.extracted else satu.modules.extracted end,doc_no=excluded.doc_no,doc_area=excluded.doc_area,updated_at=now();
 elsif a in ('module','visit','heartbeat','finish','quiz') then
  select * into item from satu.modules where id=(d->>'id')::uuid and (active or p.role in ('admin','management')) for share;
  if not found then raise exception 'MISSING'; end if;
  if a='module' then
   return jsonb_build_object('id',item.id,'title',item.title,'category',item.category,'body',item.body,'doc_no',item.doc_no,'doc_area',item.doc_area,'revision',item.revision,'active',item.active,'manual',item.manual,'attachment',item.attachment,'questions',
    case when d->>'edit'='true' and p.role in ('admin','management') then item.questions else (select coalesce(jsonb_agg(x-'correct' order by ord),'[]') from jsonb_array_elements(item.questions) with ordinality as t(x,ord)) end);
  end if;
  if not item.active then raise exception 'DENIED'; end if;
  if a='visit' then
   insert into satu.learning(person,module,visits) values(p.id,item.id,1) on conflict(person,module) do update set visits=satu.learning.visits+1,last_seen=now();
  else
   select * into rankrow from satu.learning where person=p.id and module=item.id for update;
   if not found then raise exception 'MISSING'; end if;
   if a='heartbeat' then
    update satu.learning set seconds=seconds+greatest(0,least(40,coalesce((d->>'seconds')::int,40),floor(extract(epoch from (now()-last_seen)))::int)),last_seen=now() where person=p.id and module=item.id;
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
  if p.role in ('pengawas','foreman') then raise exception 'DENIED'; end if;
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


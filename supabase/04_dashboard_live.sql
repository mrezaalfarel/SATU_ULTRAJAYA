-- Optional on Supabase hosted PostgreSQL. Install after 01_install.sql.
-- A private broadcast carries only an empty change signal. All figures come from the authenticated Worker.
begin;
create or replace function public.satu_may_listen(p_topic text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from satu.line_watchers w join satu.sessions s on s.digest=w.session_digest join satu.people p on p.id=s.person and p.active
 where w.topic::text=case when p_topic ~ '^satu-[0-9a-f-]{36}$' then substr(p_topic,6) else '' end
 and s.expires_at>now() and w.listen_until>now())
$$;
revoke all on function public.satu_may_listen(text) from public;
grant execute on function public.satu_may_listen(text) to anon,authenticated;
drop policy if exists satu_receive_pulse on realtime.messages;
create policy satu_receive_pulse on realtime.messages for select to anon,authenticated
using (extension='broadcast' and public.satu_may_listen((select realtime.topic())));
create or replace function satu.signal_reports() returns trigger language plpgsql security definer set search_path='' as $$
declare topic_id text;
begin
 for topic_id in select w.topic::text from satu.line_watchers w join satu.sessions s on s.digest=w.session_digest join satu.people p on p.id=s.person and p.active
 where w.line=new.line and satu.form_allowed(p,new.type) and s.expires_at>now() and w.listen_until>now()
 loop
  perform realtime.send('{}'::jsonb,'report_changed','satu-'||topic_id,true);
 end loop;
 return new;
exception when others then
 -- The transaction can still commit when Realtime is unavailable. The dashboard reconciles via HTTP.
 raise warning 'satu: broadcast unavailable (%)',sqlstate;
 return new;
end$$;
revoke all on function satu.signal_reports() from public,anon,authenticated;
drop trigger if exists satu_signal_after_report on satu.reports;
create trigger satu_signal_after_report after insert or update on satu.reports for each row execute function satu.signal_reports();
commit;


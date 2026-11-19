-- Edit these two example values to match the confirmed Auth user created in Supabase.
-- Keep the employee ID lowercase, with no spaces. Re-running never overwrites an existing profile.
do $$
declare emp text:='ganti-id-admin'; nama text:='Ganti Nama Admin'; uid uuid;
begin
 if emp='ganti-id-admin' or nama='Ganti Nama Admin' then raise exception 'Ganti ID dan nama admin terlebih dahulu'; end if;
 select id into uid from auth.users where email=lower(emp)||'@login.satu.invalid' and email_confirmed_at is not null;
 if uid is null then raise exception 'Buat dan konfirmasi akun Auth dengan alamat teknis yang cocok terlebih dahulu'; end if;
 insert into satu.people(id,employee,name,role,active) values(uid,lower(emp),nama,'admin',true) on conflict(id) do nothing;
end$$;


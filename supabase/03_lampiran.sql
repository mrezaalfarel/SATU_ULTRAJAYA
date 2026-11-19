-- Required only for binary LMS attachments. Text modules, manuals and quizzes work without Storage.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('satu-private','satu-private',false,12582912,array['application/pdf','image/jpeg','image/png','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;


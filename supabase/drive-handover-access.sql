-- Registry data only; no schema, user permission, workspace data or RLS changes.
-- Existing Members remain denied until their Owner grants access to the new features.
insert into public.workhub_feature_catalog(id,name,parent,paths) values
('files','Files','',array['workhub.driveFiles']::text[]),
('handover','Handover packs','',array[]::text[])
on conflict (id) do update set name=excluded.name,parent=excluded.parent,paths=excluded.paths;

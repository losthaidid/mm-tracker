-- Register SAP Tables in the existing account-document permission catalogue.
insert into public.workhub_feature_catalog (id, name, parent, paths)
values (
  'studio.tables', 'SAP Tables', 'studio',
  array['workhub.sapTables.records', 'workhub.sapTables.standard']::text[]
)
on conflict (id) do update
set name = excluded.name, parent = excluded.parent, paths = excluded.paths;

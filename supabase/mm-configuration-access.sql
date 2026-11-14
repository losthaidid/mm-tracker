-- Register the existing account-document paths for the Process Hub configuration tab.
insert into public.workhub_feature_catalog(id,name,parent,paths) values
('processhub.configuration','MM Configuration','processhub',array['workhub.mmConfiguration.materials','workhub.mmConfiguration.movements','workhub.mmConfiguration.plants','workhub.mmConfiguration.accounts']::text[])
on conflict (id) do update set name=excluded.name,parent=excluded.parent,paths=excluded.paths;

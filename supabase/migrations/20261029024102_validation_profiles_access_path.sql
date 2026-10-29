-- Keep saved run profiles under the existing Validation Studio CRUD and visibility permissions.
-- This only extends the feature registry; no workspace records, roles or policies are changed.
update public.workhub_feature_catalog
set paths = array_append(paths, 'workhub.validator.profiles')
where id = 'validator' and not ('workhub.validator.profiles' = any(paths));

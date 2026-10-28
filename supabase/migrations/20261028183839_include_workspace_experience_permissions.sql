update public.workhub_feature_catalog set paths=array_append(paths,'workhub.experience') where id='workspace' and not ('workhub.experience'=any(paths));

-- Use the existing Knowledge permission for personal folders and chapter edits.
update public.workhub_feature_catalog
set paths = array_append(paths, 'workhub.knowledgeFolders')
where id = 'knowledge' and not ('workhub.knowledgeFolders' = any(paths));

update public.workhub_feature_catalog
set paths = array_append(paths, 'workhub.knowledgeChapters')
where id = 'knowledge' and not ('workhub.knowledgeChapters' = any(paths));

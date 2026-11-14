/** SAP reference lookup and validation for the private catalogue overlay. */
(function (root) {
  'use strict';

  const D = root.WorkHubSapTablesData;
  const key = code =>
    String(code || '')
      .trim()
      .toUpperCase();
  const standard = new Map(D.tables.map(table => [key(table.code), table]));
  const searchText = value => key(value).replace(/[^A-Z0-9_]+/g, ' ');
  const text = (value, max) => typeof value === 'string' && value.length <= max;
  const namePattern = /^(?:\/[A-Z0-9_]+\/)?[A-Z0-9_]+$/i;
  const isName = code => text(code, 60) && namePattern.test(code);
  const isUrl = value =>
    value === '' || (text(value, 2000) && /^https?:\/\/[^\s<>"']+$/i.test(value));
  const personal = d => d.workhub.sapTables;
  const rows = d => personal(d)?.records || [];
  const flags = (d, code) => personal(d)?.standard?.[key(code)];

  function validate(d) {
    const library = personal(d);
    if (library === undefined) return;
    if (
      !library ||
      typeof library !== 'object' ||
      Array.isArray(library) ||
      Object.keys(library).some(name => !['records', 'standard'].includes(name))
    )
      throw Error('Check the SAP Tables library.');
    if (library.standard !== undefined) {
      const entries = library.standard;
      if (
        !entries ||
        typeof entries !== 'object' ||
        Array.isArray(entries) ||
        Object.entries(entries).some(
          ([code, entry]) =>
            !standard.has(code) ||
            !entry ||
            Object.keys(entry).some(key => !['notes', 'favorite', 'archived'].includes(key)) ||
            !text(entry.notes, 4000) ||
            typeof entry.favorite !== 'boolean' ||
            typeof entry.archived !== 'boolean'
        )
      )
        throw Error('Check the saved standard SAP table notes.');
    }
    if (library.records !== undefined) {
      if (!Array.isArray(library.records) || library.records.length > 1000)
        throw Error('SAP Tables supports up to 1,000 custom entries.');
      const ids = new Set();
      const codes = new Set(standard.keys());
      for (const table of library.records) {
        if (
          !table ||
          !text(table.id, 100) ||
          !table.id ||
          ids.has(table.id) ||
          !isName(table.code) ||
          codes.has(key(table.code)) ||
          !text(table.title, 160) ||
          !table.title.trim() ||
          !text(table.module, 40) ||
          !table.module.trim() ||
          !text(table.group, 80) ||
          !table.group.trim() ||
          !text(table.systemLabel, 100) ||
          !text(table.description, 1200) ||
          !text(table.notes, 4000) ||
          !['table', 'cds'].includes(table.kind) ||
          !Array.isArray(table.systems) ||
          !table.systems.length ||
          new Set(table.systems).size !== table.systems.length ||
          table.systems.some(system => !Object.hasOwn(D.systems, system)) ||
          !Array.isArray(table.fields) ||
          table.fields.length > 30 ||
          table.fields.some(field => !isName(field)) ||
          !Array.isArray(table.links) ||
          table.links.length > 16 ||
          table.links.some(link => !validLink(link, table)) ||
          !isUrl(table.sourceUrl) ||
          typeof table.favorite !== 'boolean' ||
          typeof table.archived !== 'boolean'
        )
          throw Error('Check the SAP table details. Names must be unique.');
        ids.add(table.id);
        codes.add(key(table.code));
      }
    }
  }

  function validLink(link, table) {
    return (
      link &&
      isName(link.code) &&
      key(link.code) !== key(table.code) &&
      text(link.fields, 180) &&
      text(link.note, 300)
    );
  }

  function editableRow(d, code) {
    const table = standard.get(key(code));
    if (table) {
      return {
        favorite: false,
        archived: false,
        notes: '',
        ...flags(d, table.code),
        ...table,
        standard: true,
      };
    }
    const row = rows(d).find(table => key(table.code) === key(code));
    return row && { ...row, standard: false };
  }

  function catalogue(d) {
    return [
      ...D.tables.map(table => editableRow(d, table.code)),
      ...rows(d).map(table => ({ ...table, standard: false })),
    ];
  }

  function linksFor(d, table) {
    const code = key(table.code);
    const links = [];
    for (const link of D.relationships) {
      if (key(link.from) !== code && key(link.to) !== code) continue;
      links.push({
        ...link,
        code: key(link.from) === code ? link.to : link.from,
        direction: key(link.from) === code ? 'out' : 'in',
      });
    }
    for (const custom of rows(d)) {
      for (const link of custom.links) {
        const outgoing = key(custom.code) === code;
        if (!outgoing && key(link.code) !== code) continue;
        const target = editableRow(d, link.code);
        const systems = target
          ? [...new Set([...custom.systems, ...target.systems])]
          : custom.systems;
        links.push({
          from: custom.code,
          to: link.code,
          code: outgoing ? link.code : custom.code,
          title: 'Personal reference',
          fields: link.fields,
          note: link.note,
          systems,
          direction: outgoing ? 'out' : 'in',
        });
      }
    }
    return links.sort((a, b) => Number(a.direction === 'in') - Number(b.direction === 'in'));
  }

  function query(d, filters = {}) {
    const exact = key(filters.query);
    const words = searchText(exact).trim().split(/\s+/).filter(Boolean);
    const workflow = Object.hasOwn(D.workflows, filters.workflow) && D.workflows[filters.workflow];
    const included = workflow && new Set(workflow.codes.map(key));
    const customLinks = new Map();
    if (words.length) {
      for (const row of rows(d))
        for (const link of row.links) {
          const target = key(link.code);
          const terms = customLinks.get(target) || [];
          terms.push(row.code, link.fields, link.note);
          customLinks.set(target, terms);
        }
    }
    return catalogue(d)
      .filter(table => {
        if (
          table.archived !== Boolean(filters.archived) ||
          (filters.favorites && !table.favorite) ||
          (filters.custom && table.standard) ||
          (filters.system && !table.systems.includes(filters.system)) ||
          (filters.module && table.module !== filters.module) ||
          (included && !included.has(key(table.code)))
        )
          return false;
        if (!words.length) return true;
        const workflowTerms = Object.values(D.workflows)
          .filter(flow => flow.codes.includes(table.code))
          .map(flow => flow.label);
        const searchable = searchText(
          [
            table.code,
            table.title,
            table.module,
            D.modules[table.module],
            table.systemLabel,
            table.description,
            table.notes,
            table.group,
            table.alternative,
            ...table.fields,
            ...workflowTerms,
            ...(customLinks.get(key(table.code)) || []),
            ...(table.links || []).flatMap(link => [link.code, link.fields, link.note]),
          ].join(' ')
        );
        return words.every(word => searchable.includes(word));
      })
      .sort((a, b) => {
        const rank = table => (key(table.code) === exact ? 0 : table.favorite ? 1 : 2);
        return rank(a) - rank(b) || a.code.localeCompare(b.code);
      });
  }

  function saveCustom(d, record, oldCode = '') {
    const store = (d.workhub.sapTables ||= {});
    const current = (store.records ||= []);
    const index = current.findIndex(table => table.id === record.id);
    const code = key(record.code);
    if (!isName(record.code)) throw Error('Use a valid SAP table or CDS name.');
    if (
      standard.has(code) ||
      current.some(table => table.id !== record.id && key(table.code) === code)
    )
      throw Error('This table name already exists. Open the existing entry to edit it.');
    if (!record.systems.length) throw Error('Choose at least one SAP system or edition.');
    if (!record.title.trim() || !record.module.trim() || !record.group.trim())
      throw Error('Enter the title, SAP module and group.');
    if (record.links.some(link => !validLink(link, record)))
      throw Error('Enter a valid related object name. An entry cannot link to itself.');
    if (index >= 0) current[index] = record;
    else current.push(record);
    // Keep other custom entries' references valid when a custom name changes.
    if (oldCode && key(oldCode) !== code)
      for (const table of current)
        for (const link of table.links)
          if (key(link.code) === key(oldCode)) link.code = record.code;
  }

  function updateAnnotation(d, table, changes) {
    const store = (d.workhub.sapTables ||= {});
    if (table.standard) {
      const entries = (store.standard ||= {});
      entries[key(table.code)] = {
        favorite: table.favorite,
        archived: table.archived,
        notes: table.notes,
        ...changes,
      };
    } else {
      const row = rows(d).find(row => row.id === table.id);
      if (!row) throw Error('This custom table no longer exists.');
      Object.assign(row, changes);
    }
  }

  root.WorkHubSapTablesEngine = {
    validate,
    query,
    catalogue,
    editableRow,
    linksFor,
    key,
    saveCustom,
    updateAnnotation,
  };
})(window);

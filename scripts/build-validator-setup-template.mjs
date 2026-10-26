/** Build the public example workbook using @oai/artifact-tool in the primary runtime. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const repo = process.argv[2];
if (!repo) throw Error('Pass the mm-tracker source directory.');
const scope = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(repo, 'validator-engine.js'), 'utf8'), scope);
vm.runInNewContext(await fs.readFile(path.join(repo, 'validator-setup.js'), 'utf8'), scope);
const headers = scope.window.WorkHubValidatorSetup.HEADERS;
const workbook = Workbook.create();
const outputDir = path.resolve('outputs/validation-setup-20261026');
await fs.mkdir(outputDir, { recursive: true });
function add(name, values, widths) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  const last = values[0].length - 1;
  const used = sheet.getRangeByIndexes(0, 0, values.length, last + 1);
  used.values = values;
  used.format.font = { name: 'Arial', size: 10, color: '#243449' };
  used.format.verticalAlignment = 'center';
  used.format.rowHeight = 34;
  used.format.wrapText = true;
  const heading = sheet.getRangeByIndexes(0, 0, 1, last + 1);
  heading.format.fill = '#31596A';
  heading.format.font = { name: 'Arial', size: 10, color: '#FFFFFF', bold: true };
  heading.format.horizontalAlignment = 'center';
  heading.format.rowHeight = 38;
  for (let x = 0; x <= last; x++)
    sheet.getRangeByIndexes(0, x, values.length, 1).format.columnWidth = widths[x] || 22;
  if (values.length > 1)
    sheet.getRangeByIndexes(1, 0, values.length - 1, last + 1).format.fill = '#FFF9E8';
  sheet.freezePanes.freezeRows(1);
  if (last > 5) sheet.freezePanes.freezeColumns(2);
  return sheet;
}
function rows(name, records) {
  return [headers[name], ...records.map(r => headers[name].map(h => r[h] ?? ''))];
}
const template = add(
  'Template',
  rows('Template', [
    {
      Name: 'Material movement checks',
      Description:
        'Example configuration. Replace the fields, conditions and fictional reference codes with your own definitions.',
      'Format version': 1,
      'Template type': 'General',
    },
  ]),
  [35, 75, 18, 20]
);
template.getRange('A2:D2').format.rowHeight = 58;
const columns = add(
  'Columns',
  rows('Columns', [
    {
      Field: 'MATERIAL',
      Label: 'Material',
      Type: 'text',
      Required: 'Yes',
      'Max length': 18,
      Aliases: 'Material number',
      Description: 'Keep identifiers as text to preserve leading zeros.',
    },
    { Field: 'PLANT', Label: 'Plant', Type: 'text', Required: 'Yes', 'Max length': 4 },
    { Field: 'STORAGE_LOCATION', Label: 'Storage location', Type: 'text', 'Max length': 4 },
    { Field: 'QUANTITY', Label: 'Quantity', Type: 'decimal', Required: 'Yes', Min: 0 },
    {
      Field: 'MOVEMENT_TYPE',
      Label: 'Movement type',
      Type: 'text',
      Required: 'Yes',
      'Allowed values': '101,201',
      'Max length': 3,
    },
    { Field: 'COST_CENTER', Label: 'Cost center', Type: 'text', 'Max length': 10 },
  ]),
  [25, 23, 14, 13, 13, 14, 14, 13, 13, 24, 24, 13, 17, 19, 45, 18, 14, 14, 24]
);
columns.getRange('C2:C201').dataValidation = {
  rule: { type: 'list', values: ['text', 'integer', 'decimal', 'date', 'boolean'] },
};
for (const c of ['D', 'E', 'L', 'M'])
  columns.getRange(c + '2:' + c + '201').dataValidation = {
    rule: { type: 'list', values: ['Yes', 'No'] },
  };
columns.getRange('N2:N201').dataValidation = {
  rule: { type: 'list', values: ['digits', 'alphanumeric', 'email', 'url', 'identifier'] },
};
const conditions = add(
  'Conditions',
  rows('Conditions', [
    {
      'Rule ID': 'plant-valid',
      Name: 'Plant is maintained',
      Part: 'assert',
      Field: 'PLANT',
      Operator: 'lookup',
      'Reference ID': 'plants',
      'Reference column': 'Plant',
      Message: 'Choose a maintained plant.',
    },
    {
      'Rule ID': 'storage-valid',
      Name: 'Storage location belongs to plant',
      Part: 'when',
      Group: 'root',
      Join: 'all',
      Field: 'STORAGE_LOCATION',
      Operator: 'notEmpty',
    },
    {
      'Rule ID': 'storage-valid',
      Part: 'assert',
      Field: 'STORAGE_LOCATION',
      Operator: 'lookupTuple',
      'Reference ID': 'locations',
      Pairs: 'PLANT=Plant;STORAGE_LOCATION=Storage location',
    },
    {
      'Rule ID': 'cost-center-issue',
      Name: 'Cost center for issue',
      Part: 'when',
      Group: 'root',
      Join: 'all',
      Field: 'MOVEMENT_TYPE',
      Operator: 'eq',
      Value: '201',
    },
    { 'Rule ID': 'cost-center-issue', Part: 'assert', Field: 'COST_CENTER', Operator: 'notEmpty' },
  ]),
  [22, 36, 14, 14, 14, 14, 12, 24, 19, 23, 24, 22, 25, 58, 40]
);
conditions.getRange('C2:C201').dataValidation = {
  rule: { type: 'list', values: ['error', 'warning'] },
};
conditions.getRange('D2:D100').dataValidation = { rule: { type: 'list', values: ['Yes', 'No'] } };
conditions.getRange('E2:E100').dataValidation = {
  rule: { type: 'list', values: ['assert', 'when', 'group'] },
};
conditions.getRange('G2:G100').dataValidation = { rule: { type: 'list', values: ['all', 'any'] } };
add(
  'References',
  rows('References', [
    {
      'Reference ID': 'plants',
      Name: 'Maintained plants',
      Sheet: 'Plants',
      'Code column': 'Plant',
      'Name column': 'Name',
      'Description columns': 'Description',
    },
    {
      'Reference ID': 'locations',
      Name: 'Plant storage locations',
      Sheet: 'Storage locations',
      'Code column': 'Storage location',
      'Name column': 'Name',
    },
  ]),
  [22, 32, 26, 25, 23, 30]
);
add(
  'Unique combinations',
  rows('Unique combinations', [{ Fields: 'MATERIAL,PLANT,STORAGE_LOCATION' }]),
  [55]
);
add(
  'Plants',
  [
    ['Plant', 'Name', 'Description'],
    ['P001', 'Example plant one', 'Fictional plant for learning the setup format.'],
    ['P002', 'Example plant two', 'Replace these example values before saving your own setup.'],
  ],
  [20, 32, 65]
);
const storageLocations = add(
  'Storage locations',
  [
    ['Plant', 'Storage location', 'Name'],
    ['P001', '0001', 'Example raw materials'],
    ['P002', '0002', 'Example finished goods'],
  ],
  [20, 25, 40]
);
storageLocations.getRange('B2:B3').setNumberFormat('0000');
const guideRows = [
  ['Topic', 'How to fill the workbook', 'Example'],
  [
    'Start here',
    'Edit Template, then Columns. Each field uses one row. Header rows must stay in row 1. Delete example rows you do not need.',
    'Template: one name row. Columns: 1–200 fields.',
  ],
  [
    'Import',
    'In Validation Studio choose Import Excel setup, upload this workbook, review the preview and Create new draft. Review the tabs, then Save draft.',
    'Your saved templates and published versions are preserved.',
  ],
  [
    'Columns',
    'Field is the technical key used in every rule. Label is the upload header. Types: text, integer, decimal, date, boolean. Use text for codes with leading zeros.',
    'MATERIAL / Material / text',
  ],
  [
    'Column options',
    'Required and Unique default to No. Trim defaults to Yes. Case sensitive defaults to No. Use Yes/No, true/false or 1/0.',
    'A blank Min or Max means no limit. Zero is a valid limit.',
  ],
  [
    'Limits and lists',
    'Min length/Max length are character counts. Min/Max are numeric limits. Allowed values and Aliases use comma-separated or newline-separated lists.',
    'Allowed values: 101,201',
  ],
  [
    'Formats',
    'Optional Format: digits, alphanumeric, email, url or identifier. Leave blank for no format check.',
    'identifier allows letters, numbers, underscores and hyphens.',
  ],
  [
    'Conditions',
    'Use one Rule ID for each rule. Each rule needs exactly one assert row. Add when rows under the same ID for the trigger. With no when rows, the rule always applies.',
    'Name, Severity, Enabled and Message can be set on the first row.',
  ],
  [
    'Rule options',
    'Severity defaults to error; warning is also available. Enabled defaults to Yes. Repeated non-empty metadata must match within each Rule ID.',
    'Field values must match the exact technical keys from Columns.',
  ],
  [
    'Groups',
    'When rows use root by default. Join all means AND. Join any means OR. Nested groups use 1, 1.1, 2, etc., up to four levels. Optional group rows declare a group and its Join.',
    'Group root / Join all; Group 1 / Join any',
  ],
  [
    'Simple operators',
    'Use eq, neq, empty, notEmpty, gt, gte, lt, lte, contains, starts, ends, in or notIn. Put the comparison in Value. For in/notIn use a comma or newline list.',
    'MOVEMENT_TYPE / eq / 201',
  ],
  [
    'Field operators',
    'Use fieldEq, fieldNeq, fieldGte or fieldLte and fill Other field. The rule compares the two fields in the same upload row.',
    'END_DATE / fieldGte / Other field START_DATE',
  ],
  [
    'Format operator',
    'Use pattern and a supported format name in Value.',
    'CONTACT / pattern / email',
  ],
  [
    'Reference lists',
    'On References, give each list an ID, name and data Sheet. Put that data sheet’s headers in row 1 and values below. Set Code column, optional Name column and up to five Description columns.',
    'Separate Description columns with semicolons or newlines.',
  ],
  [
    'Reference lookup',
    'Use lookup with Reference ID and Reference column. The field must exist in that column. Each list allows 30 columns and 2,000 data rows.',
    'PLANT / lookup / plants / Plant',
  ],
  [
    'Reference combinations',
    'Use lookupTuple with Reference ID and Pairs. Map two to ten fields to different reference columns, including the highlighted Field.',
    'PLANT=Plant;STORAGE_LOCATION=Storage location',
  ],
  [
    'Unique combinations',
    'Put two to ten technical field names in Fields, separated by commas. Each row defines a distinct combination that must be unique in an upload.',
    'MATERIAL,PLANT,STORAGE_LOCATION',
  ],
  [
    'Limits',
    'Up to 200 columns, 100 rules, 400 when clauses, 20 reference lists and 20 unique combinations. Keep the workbook below 10 MB.',
    'Remove a sheet only when you do not use that section. Template and Columns are required.',
  ],
  [
    'Values only',
    'Save as .xlsx. Enter rule values as text or numbers, not Excel formulas. Formula cells and Excel errors are rejected. Reference codes with leading zeros must remain text.',
    'This file configures validation rules. Use the Validate tab for data files to check.',
  ],
];
guideRows.push(
  [
    'Template type',
    'General preserves the existing checks. For SAP choose SAP in Template, and fill SAP type, SAP length, SAP decimals and optional SAP reference field on Columns. General Type stays text if unused.',
    'SAP date DATS / 8; currency CURR / 15 / 2 → CUKY field.',
  ],
  [
    'SAP formats',
    'Use internal formats: DATS YYYYMMDD (initial 00000000), TIMS HHMMSS, NUMC fixed digits, signed plain decimals with a dot. No zero padding, rounding or conversion exits are applied.',
    'Keep technical codes and long numbers as Text in Excel.',
  ],
  [
    'SAP scope',
    '18 supported DDIC formats. Use actual SE11 definitions. Domain values, conversion exits and currency display scaling need your system-specific Conditions/References.',
    'Source: https://help.sap.com/doc/abapdocu_754_index_htm/7.54/en-US/abenddic_builtin_types.htm',
  ],
  [
    'Simpler option',
    'For column setup without Excel conditions/references, use the one-sheet simple General or SAP setup download instead. You can maintain Conditions and References later inside Studio.',
    'A single Setup sheet: name in B2, type in B3, fields from row 9.',
  ],
  [
    'Upload size',
    'Data validation stays within 5,000 rows and 200,000 cells. At 200 columns, upload up to 1,000 data rows per file.',
    'Setup rows define fields; data rows are uploaded separately on Validate.',
  ]
);
const guide = add('Guide', guideRows, [25, 100, 65]);
guide.getRange('A2:D20').format.rowHeight = 64;
guide.getRange('A2:D20').format.fill = '#F4F6F8';
workbook.recalculate();
console.log((await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 1600 })).ndjson);
console.log(
  (
    await workbook.inspect({
      kind: 'match',
      searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',
      options: { useRegex: true, maxResults: 10 },
      summary: 'Template formula error scan',
    })
  ).ndjson
);
for (const [sheetName, range] of [
  ['Template', 'A1:D2'],
  ['Columns', 'A1:S7'],
  ['Conditions', 'A1:O6'],
  ['References', 'A1:F3'],
  ['Unique combinations', 'A1:A2'],
  ['Plants', 'A1:C3'],
  ['Storage locations', 'A1:C3'],
  ['Guide', 'A1:C' + guideRows.length],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(
    path.join(outputDir, sheetName.replaceAll(' ', '-') + '.png'),
    new Uint8Array(await preview.arrayBuffer())
  );
}
const result = await SpreadsheetFile.exportXlsx(workbook);
await result.save(path.join(outputDir, 'validation-setup-template.xlsx'));
await fs.copyFile(
  path.join(outputDir, 'validation-setup-template.xlsx'),
  path.join(repo, 'validation-setup-template.xlsx')
);
console.log('Saved validation-setup-template.xlsx');

// The default setup downloads need only one worksheet. Blank field rows are deliberate inputs.
const E = scope.window.WorkHubValidatorEngine;
const simpleHeaders = scope.window.WorkHubValidatorSetup.SIMPLE_HEADERS;
const examples = {
  general: [
    [
      'RECORD_ID',
      'Record ID',
      'text',
      20,
      '',
      'Yes',
      '',
      'identifier',
      '',
      'Keep codes as Text, e.g. 000012.',
    ],
    [
      'APPROVED',
      'Approved',
      'text',
      1,
      '',
      'No',
      'X',
      '',
      '',
      'X or blank is allowed because Required is No.',
    ],
    ['AMOUNT', 'Amount', 'decimal', '', '', 'Yes', '', '', '', 'Use a decimal point, e.g. 125.50.'],
    ['DUE_DATE', 'Due date', 'date', '', '', 'No', '', '', '', 'General dates use YYYY-MM-DD.'],
  ],
  sap: [
    ['CLIENT', 'Client', 'CLNT', 3, 0, 'Yes', '', '', '', 'Internal key: 100.'],
    [
      'MATERIAL',
      'Material',
      'CHAR',
      18,
      0,
      'Yes',
      '',
      '',
      '',
      'Example length only: use your actual SE11/DDIC definition.',
    ],
    [
      'BATCH',
      'Batch',
      'NUMC',
      10,
      0,
      'No',
      '',
      '',
      '',
      'Illustrative numeric code: 0000000001. Choose CHAR if your batch allows letters.',
    ],
    [
      'POSTING_DATE',
      'Posting date',
      'DATS',
      8,
      0,
      'Yes',
      '',
      '',
      '',
      'YYYYMMDD, e.g. 20261026; initial 00000000 is valid.',
    ],
    [
      'AMOUNT',
      'Amount',
      'CURR',
      15,
      2,
      'Yes',
      '',
      '',
      'CURRENCY',
      'Plain decimal, e.g. 125.50; reference uses the Field key.',
    ],
    [
      'CURRENCY',
      'Currency',
      'CUKY',
      5,
      0,
      'Yes',
      '',
      '',
      '',
      'Internal code, e.g. MYR. Maintain valid codes in References.',
    ],
    ['QUANTITY', 'Quantity', 'QUAN', 13, 3, 'No', '', '', 'UNIT', 'Plain decimal, e.g. 12.500.'],
    ['UNIT', 'Unit', 'UNIT', 3, 0, 'No', '', '', '', 'Internal code, e.g. KG.'],
    [
      'APPROVED',
      'Approved',
      'CHAR',
      1,
      0,
      'No',
      'X',
      '',
      '',
      'X or blank: no trailing comma needed.',
    ],
  ],
};
for (const mode of ['general', 'sap']) {
  const wb = Workbook.create(),
    sheet = wb.worksheets.add('Setup');
  const sap = mode === 'sap',
    label = sap ? 'SAP' : 'General';
  sheet.showGridLines = false;
  const all = sheet.getRange('A1:J208');
  all.format.font = { name: 'Arial', size: 10, color: '#243449' };
  all.format.verticalAlignment = 'center';
  all.format.wrapText = true;
  all.format.rowHeight = 36;
  all.setNumberFormat('@');
  [22, 20, 16, 10, 10, 11, 22, 16, 21, 48].forEach((width, i) => {
    sheet.getRangeByIndexes(0, i, 208, 1).format.columnWidth = width;
  });
  for (const range of [
    'A1:J1',
    'B2:E2',
    'F2:J2',
    'B3:C3',
    'D3:J3',
    'B4:J4',
    'A5:J5',
    'A6:J6',
    'A7:J7',
  ])
    sheet.getRange(range).merge();
  sheet.getRange('A1').values = [
    ['VALIDATION STUDIO  /  SIMPLE ' + label.toUpperCase() + ' SETUP'],
  ];
  sheet.getRange('A1:J1').format.fill = '#31596A';
  sheet.getRange('A1:J1').format.font = { name: 'Arial', size: 15, bold: true, color: '#FFFFFF' };
  sheet.getRange('A1:J1').format.rowHeight = 45;
  sheet.getRange('A2:A4').values = [['Template name'], ['Template type'], ['Description']];
  sheet.getRange('A2:A4').format.font = { name: 'Arial', size: 10, bold: true, color: '#31596A' };
  sheet.getRange('B2').values = [[sap ? 'SAP field format checks' : 'Everyday file checks']];
  sheet.getRange('F2').values = [
    ['1  Name it  →  2  Replace examples below  →  3  Import Excel setup in Studio'],
  ];
  sheet.getRange('B3').values = [[label]];
  sheet.getRange('D3').values = [
    [
      sap
        ? 'SAP: internal field formats. Use the actual DDIC type, length and decimal places.'
        : 'General: existing text, number, date, boolean and format checks.',
    ],
  ];
  sheet.getRange('B4').values = [
    [
      'Replace these fictional example fields with your own. Each row below creates one data upload column.',
    ],
  ];
  for (const range of ['B2:E2', 'B3:C3', 'B4:J4']) sheet.getRange(range).format.fill = '#FFF2C9';
  sheet.getRange('A5').values = [
    [
      'Keep the row 8 headers. Replace or delete examples from row 9; one field per row, up to 200. Label is optional. Required defaults to No. Allowed values X + Required No means X or blank.',
    ],
  ];
  sheet.getRange('A6').values = [
    [
      sap
        ? 'SAP: CHAR / NUMC / DATS / TIMS / CLNT / LANG / CUKY / UNIT / DEC / CURR / QUAN / INT1 / INT2 / INT4 / INT8 / SSTRING / STRING / RAW. Format is automatic; leave Format blank. CURR can reference a CUKY Field; QUAN a UNIT Field. Domain values and conversion exits need your own Conditions or References.'
        : 'General: Data type = text, integer, decimal, date or boolean. Length = optional maximum characters. Format = optional digits, alphanumeric, email, url or identifier. Leave Decimals and Reference field blank. Dates use YYYY-MM-DD.',
    ],
  ];
  sheet.getRange('A5:J6').format.fill = '#EFF5F7';
  sheet.getRange('A5:J6').format.rowHeight = 54;
  sheet.getRange('A7').values = [
    [
      'Yellow cells are yours to edit. Keep codes and long numbers as Excel Text. Use values, not formulas. Import this file → review → Create new draft → Save draft. Upload records separately on Validate.',
    ],
  ];
  sheet.getRange('A7:J7').format.font = { name: 'Arial', size: 10, italic: true, color: '#526276' };
  sheet.getRange('A8:J8').values = [simpleHeaders];
  sheet.getRange('A8:J8').format.fill = '#31596A';
  sheet.getRange('A8:J8').format.font = { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' };
  sheet.getRange('A9:J208').format.fill = '#FFFBEE';
  sheet.getRange('D9:E208').setNumberFormat('0');
  sheet.getRangeByIndexes(8, 0, examples[mode].length, 10).values = examples[mode];
  sheet.getRangeByIndexes(8, 0, examples[mode].length, 10).format.rowHeight = 49;
  sheet.getRange('B3').dataValidation = { rule: { type: 'list', values: ['General', 'SAP'] } };
  sheet.getRange('C9:C208').dataValidation = {
    rule: { type: 'list', values: sap ? Object.keys(E.SAP_TYPES) : [...E.TYPES] },
  };
  sheet.getRange('F9:F208').dataValidation = { rule: { type: 'list', values: ['Yes', 'No'] } };
  sheet.getRange('H9:H208').dataValidation = {
    rule: { type: 'list', values: sap ? ['standard'] : Object.keys(E.FORMATS) },
  };
  sheet.freezePanes.freezeRows(8);
  sheet.freezePanes.freezeColumns(2);
  wb.recalculate();
  console.log(
    (
      await wb.inspect({
        kind: 'table',
        range: 'Setup!A1:J17',
        include: 'values,formulas',
        maxChars: 1800,
      })
    ).ndjson
  );
  console.log(
    (
      await wb.inspect({
        kind: 'match',
        searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',
        options: { useRegex: true, maxResults: 10 },
        summary: label + ' formula error scan',
      })
    ).ndjson
  );
  const preview = await wb.render({
    sheetName: 'Setup',
    range: sap ? 'A1:J17' : 'A1:J12',
    scale: 1.25,
    format: 'png',
  });
  await fs.writeFile(
    path.join(outputDir, 'simple-' + mode + '.png'),
    new Uint8Array(await preview.arrayBuffer())
  );
  const filename = sap ? 'validation-setup-sap.xlsx' : 'validation-setup-simple.xlsx';
  await (await SpreadsheetFile.exportXlsx(wb)).save(path.join(outputDir, filename));
  await fs.copyFile(path.join(outputDir, filename), path.join(repo, filename));
  console.log('Saved ' + filename);
}

/** Build the public example workbook using @oai/artifact-tool in the primary runtime. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const repo = process.argv[2];
if (!repo) throw Error('Pass the mm-tracker source directory.');
const scope = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(repo, 'validator-setup.js'), 'utf8'), scope);
const headers = scope.window.WorkHubValidatorSetup.HEADERS;
const workbook = Workbook.create();
const outputDir = path.resolve('outputs/validation-setup-20261023');
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
    },
  ]),
  [35, 75, 18]
);
template.getRange('A2:C2').format.rowHeight = 58;
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
  [25, 23, 14, 13, 13, 14, 14, 13, 13, 24, 24, 13, 17, 19, 45]
);
columns.getRange('C2:C100').dataValidation = {
  rule: { type: 'list', values: ['text', 'integer', 'decimal', 'date', 'boolean'] },
};
for (const c of ['D', 'E', 'L', 'M'])
  columns.getRange(c + '2:' + c + '100').dataValidation = {
    rule: { type: 'list', values: ['Yes', 'No'] },
  };
columns.getRange('N2:N100').dataValidation = {
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
conditions.getRange('C2:C100').dataValidation = {
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
    'Template: one name row. Columns: 1–80 fields.',
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
    'Up to 80 columns, 100 rules, 400 when clauses, 20 reference lists and 20 unique combinations. Keep the workbook below 10 MB.',
    'Remove a sheet only when you do not use that section. Template and Columns are required.',
  ],
  [
    'Values only',
    'Save as .xlsx. Enter rule values as text or numbers, not Excel formulas. Formula cells and Excel errors are rejected. Reference codes with leading zeros must remain text.',
    'This file configures validation rules. Use the Validate tab for data files to check.',
  ],
];
const guide = add('Guide', guideRows, [25, 100, 65]);
guide.getRange('A2:C20').format.rowHeight = 64;
guide.getRange('A2:C20').format.fill = '#F4F6F8';
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
  ['Template', 'A1:C2'],
  ['Columns', 'A1:O7'],
  ['Conditions', 'A1:O6'],
  ['References', 'A1:F3'],
  ['Unique combinations', 'A1:A2'],
  ['Plants', 'A1:C3'],
  ['Storage locations', 'A1:C3'],
  ['Guide', 'A1:C20'],
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

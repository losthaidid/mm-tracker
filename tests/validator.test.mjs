import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,after} from 'node:test';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only'}),w=dom.window;
w.Blob=Blob;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.setImmediate=setImmediate;w.clearImmediate=clearImmediate;
w.eval(readFileSync(new URL('../vendor/jszip.min.js',import.meta.url),'utf8'));
for(const file of ['validator-engine.js','validator-files.js'])w.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,copy=v=>JSON.parse(JSON.stringify(v));
after(()=>w.close());
const schema=()=>E.example();
const row=(values={})=>({REQUEST_ID:'00001',TYPE:'Standard',OWNER:'Aisha',AMOUNT:'25.5',START_DATE:'2026-10-20',END_DATE:'2026-10-21',...values});
test('validator distinguishes hard errors, review warnings and clean rows without mutating data',()=>{
 const t=schema(),data=[row(),row({REQUEST_ID:'00002',TYPE:'Urgent',OWNER:'',AMOUNT:'-5',END_DATE:'2026-10-19'}),row({REQUEST_ID:'00003',AMOUNT:'15000'})],before=copy(data),r=E.validateRows(t,data);
 assert.deepEqual(copy(data),before);assert.equal(r.rows,3);assert.equal(r.passed,2);assert.equal(r.errors,3);assert.equal(r.warnings,1);assert.equal(r.clean,1);assert.equal(r.issues.find(x=>x.field==='OWNER').row,3);
});
test('nested AND/OR groups evaluate typed comparisons and blank checks',()=>{
 const t=schema(),r=E.rule('OWNER');r.when={join:'all',conditions:[{...E.condition('AMOUNT'),operator:'gte',value:'20'}],groups:[{join:'any',conditions:[{...E.condition('TYPE'),value:'Urgent'},{...E.condition('REQUEST_ID'),operator:'starts',value:'VIP'}],groups:[]}]};r.message='Owner needed';t.rules=[r];
 assert.equal(E.validateRows(t,[row({OWNER:''})]).errors,0);
 assert.equal(E.validateRows(t,[row({OWNER:'',TYPE:'Urgent'})]).errors,1);
 assert.equal(E.validateRows(t,[row({OWNER:'',REQUEST_ID:'VIP0001'})]).errors,1);
 assert.equal(E.validateRows(t,[row({OWNER:'',REQUEST_ID:'VIP0001',AMOUNT:'10'})]).errors,0);
});
test('all duplicate participants and composite duplicate keys are flagged, including leading-zero IDs',()=>{
 const t=schema();t.columns[0].unique=false;t.uniqueGroups=[['REQUEST_ID','TYPE']];t.rules=[];
 const result=E.validateRows(t,[row(),row(),row({REQUEST_ID:'1'}),row({TYPE:'Urgent'})]);
 assert.equal(result.errors,2);assert.equal(result.passed,2);assert.deepEqual(copy(result.issues.map(x=>x.index)),[0,1]);
});
test('references follow the field case policy and compare the chosen reference column',()=>{
 const t=schema();t.lookups=[{id:'costs',name:'Allowed owners',headers:['Code','Owner'],rows:[['001','AISHA'],['002','Daniel']]}];
 const r=E.rule('OWNER');r.assertion={...E.condition('OWNER'),operator:'lookup',lookupId:'costs',lookupColumn:'Owner'};t.rules=[r];
 assert.equal(E.validateRows(t,[row()]).errors,0);t.columns.find(c=>c.key==='OWNER').caseSensitive=true;
 assert.equal(E.validateRows(t,[row()]).errors,1);
 t.rules[0].assertion.lookupColumn='Missing';assert.throws(()=>E.checkSchema(t),/reference/);
});
test('date validation rejects impossible dates and numeric and boolean checks preserve zero',()=>{
 const t=schema();t.rules=[];t.columns.push({...E.column(6),key:'APPROVED',label:'Approved',type:'boolean',required:true});
 assert.equal(E.validateRows(t,[{...row({AMOUNT:'0'}),APPROVED:'false'}]).errors,0);
 const r=E.validateRows(t,[{...row({START_DATE:'2026-02-30',AMOUNT:'12x'}),APPROVED:'maybe'}]);assert.equal(r.errors,3);
});
test('malformed and ambiguous definitions cannot be published or restored as valid schemas',()=>{
 const t=schema();t.columns[0].key='constructor';assert.throws(()=>E.checkSchema(t),/Technical/);
 const duplicate=schema();duplicate.columns[1].label=duplicate.columns[0].label;assert.throws(()=>E.checkSchema(duplicate),/unique label/);
 const group=schema();group.rules[0].when.groups.push(E.group());assert.throws(()=>E.checkSchema(group),/nested group/);
 const invalid=schema();invalid.rules[0].assertion.field='DOES_NOT_EXIST';assert.throws(()=>E.checkSchema(invalid),/existing field/);
});
test('published versions stay unchanged while drafts evolve and explicit backup restore is supported',()=>{
 const t=schema();t.releases.push({version:1,publishedAt:new Date().toISOString(),schema:E.schema(t)});
 const old={workhub:{validator:{templates:[t],runs:[]}}},next=copy(old);next.workhub.validator.templates[0].columns[0].label='New draft label';E.prepare(next,old);
 next.workhub.validator.templates[0].releases[0].schema.name='Changed';assert.throws(()=>E.prepare(next,old),/frozen/);E.prepare(next,old,true);
});
test('CSV handles BOM, escaped quotes, multiline values, empty rows and delimiters outside quotes',()=>{
 const parsed=E.parseCSV('\uFEFF"First, last";ID\r\n"A ""quoted""\nname";00012\r\n;\r\nOther;0\r\n');
 assert.deepEqual(copy(parsed),[['First, last','ID'],['A "quoted"\nname','00012'],['',''],['Other','0']]);
 assert.throws(()=>E.parseCSV('A,B\n"unclosed,1'),/unclosed/);
 assert.throws(()=>E.parseCSV('A,B\n"x"bad,1'),/Unexpected/);
 assert.match(E.csv([['=HYPERLINK("x")','00012']]),/"'=HYPERLINK/);
});
test('mapping requires deliberate choices for ambiguous aliases, duplicate sources and required fields',()=>{
 const t=schema(),headers=['ID','Request ID','Type','Owner','Amount','Start date','End date'];t.columns[0].aliases='ID';
 const mapped=E.autoMap(headers,t);assert.equal(mapped.REQUEST_ID,-1);mapped.REQUEST_ID=1;
 const data=E.mapRows(headers,[['unused','00012','Standard','Aisha','0','2026-10-20','2026-10-21']],t,mapped);assert.equal(data[0].REQUEST_ID,'00012');assert.equal(data[0].AMOUNT,'0');
 assert.throws(()=>E.mapRows(['ID','id'],[],t,mapped),/unique/);
 mapped.TYPE=1;assert.throws(()=>E.mapRows(headers,[],t,mapped),/only be mapped once/);
});
test('issue truncation never hides errors from totals or accepted-row decisions',()=>{
 const t=schema();t.rules=Array.from({length:100},(_,i)=>({...E.rule('OWNER'),id:'r'+i,name:'Rule '+i}));const rows=Array.from({length:200},(_,i)=>row({REQUEST_ID:String(i),OWNER:''})),r=E.validateRows(t,rows);
 assert.equal(r.issues.length,15000);assert.equal(r.errors,20000);assert.equal(r.passed,0);assert.equal(r.truncated,true);
});
test('XLSX template and issue export round-trip through the actual reader with literal formula-like strings',{timeout:10000},async()=>{
 const t=schema(),blob=await F.template(t),read=await F.read({name:'template.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
 assert.deepEqual(copy(read.sheets[0].rows[0]),copy(t.columns.map(c=>c.label)));assert.ok(read.sheets.some(s=>s.name==='Field guide'));
 const data=[row({REQUEST_ID:'000012',OWNER:'=1+1'}),row({REQUEST_ID:'000013',AMOUNT:'-1'})],r=E.validateRows(t,data),report=await F.report(t,data,r),loaded=await F.read({name:'report.xlsx',size:report.size,arrayBuffer:()=>report.arrayBuffer()});
 assert.equal(loaded.sheets[0].rows[1][0],'000012');assert.equal(loaded.sheets[0].rows[1][2],'=1+1');assert.equal(loaded.sheets[0].rows[1][4],'2026-10-20');assert.equal(loaded.sheets[0].rows[1][3],'25.5');
 assert.ok(loaded.sheets.find(s=>s.name==='Issues').rows.length>1);
 const zip=await w.JSZip.loadAsync(new w.Uint8Array(await report.arrayBuffer()));assert.ok(!(await zip.file('xl/worksheets/sheet1.xml').async('string')).includes('<f>'));
 const accepted=await F.report(t,data,r,true),a=await F.read({name:'accepted.xlsx',size:accepted.size,arrayBuffer:()=>accepted.arrayBuffer()});assert.equal(a.sheets[0].rows.length,2);
});
test('XLSX formula cells and unsupported archives are refused with actionable messages',{timeout:10000},async()=>{
 const t=schema(),blob=await F.template(t),zip=await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer())),path='xl/worksheets/sheet1.xml';
 const source=await zip.file(path).async('string');zip.file(path,source.replace('</sheetData>','<row r="2"><c r="A2"><f>1+1</f><v>2</v></c></row></sheetData>'));
 const bytes=await zip.generateAsync({type:'uint8array'});await assert.rejects(F.read({name:'formulas.xlsx',size:bytes.length,arrayBuffer:async()=>bytes}),/contains a formula/);
 await assert.rejects(F.read({name:'legacy.xls',size:10}),/Save legacy/);
 assert.equal(F.excelDate('1',false),'1900-01-01');assert.equal(F.excelDate('61',false),'1900-03-01');assert.equal(F.excelDate('0',true),'1904-01-01');assert.throws(()=>F.excelDate('60',false),/unsupported/);
});

function tupleSchema(){const t=E.create('Plant and storage'),p={...E.column(0),key:'PLANT',label:'Plant'},s={...E.column(1),key:'SLOC',label:'Storage location'};t.columns=[p,s];t.lookups=[{id:'locations',name:'Storage assignments',headers:['Plant','Storage','Name','Purpose'],rows:[['0001','A1','Main stock','Standard stock'],['0002','B1','Returns','Customer returns']],codeColumn:'Storage',nameColumn:'Name',descriptionColumns:['Purpose']}];const r=E.rule('SLOC');r.assertion={...E.condition('SLOC'),operator:'lookupTuple',lookupId:'locations',pairs:[{field:'PLANT',referenceColumn:'Plant'},{field:'SLOC',referenceColumn:'Storage'}]};t.rules=[r];return t;}
test('reference combinations match the same row, retain leading zeros and use each field policy',()=>{const t=tupleSchema(),r=E.validateRows(t,[{PLANT:'0001',SLOC:'a1'},{PLANT:'0001',SLOC:'B1'},{PLANT:'1',SLOC:'A1'},{PLANT:'0002',SLOC:''}]);assert.equal(r.passed,1);assert.equal(r.errors,3);t.columns[1].caseSensitive=true;assert.equal(E.validateRows(t,[{PLANT:'0001',SLOC:'a1'}]).errors,1);});
test('combination mappings reject duplicates, missing columns and omitted highlighted fields',()=>{const t=tupleSchema();t.rules[0].assertion.pairs[1].referenceColumn='Plant';assert.throws(()=>E.checkSchema(t),/Map two to ten/);t.rules[0].assertion.pairs[1].referenceColumn='Missing';assert.throws(()=>E.checkSchema(t),/Map two to ten/);t.rules[0].assertion.pairs=[null,null];assert.throws(()=>E.checkSchema(t),/Map two to ten/);});
test('reference explanations use only matched rows and preserve ambiguous descriptions',()=>{const t=tupleSchema();t.lookups[0].rows.push(['0001','A1','Alternate label','Review configuration']);const matches=E.referenceDetails(t,{PLANT:'0001',SLOC:'A1'});assert.equal(matches.length,2);assert.equal(matches[0].code,'A1');assert.equal(matches[0].displayName,'Main stock');assert.equal(matches[0].matchCount,2);assert.equal(matches[0].sourceRow,2);assert.deepEqual(copy(matches[0].fields),['Plant','Storage location']);assert.equal(E.referenceDetails(t,{PLANT:'0001',SLOC:'B1'}).length,0);});
test('reference metadata and combination settings remain frozen in published versions',()=>{const t=tupleSchema();t.releases=[{version:1,publishedAt:new Date().toISOString(),schema:E.schema(t)}];const before={workhub:{validator:{templates:[copy(t)],runs:[]}}},next=copy(before);next.workhub.validator.templates[0].lookups[0].nameColumn='Purpose';E.prepare(next,before);next.workhub.validator.templates[0].releases[0].schema.lookups[0].nameColumn='Purpose';assert.throws(()=>E.prepare(next,before),/frozen/);});
test('Excel reference matches export code meanings without treating text as formulas',async()=>{const t=tupleSchema();t.lookups[0].rows[0][2]='=DO_NOT_EXECUTE()';const rows=[{PLANT:'0001',SLOC:'A1'}],result=E.validateRows(t,rows),blob=await F.report(t,rows,result);const bytes=await blob.arrayBuffer();const zip=await w.JSZip.loadAsync(new w.Uint8Array(bytes));const book=await zip.file('xl/workbook.xml').async('string');assert.ok(book.includes('Reference matches'));const sheet=await zip.file('xl/worksheets/sheet4.xml').async('string');assert.ok(sheet.includes('=DO_NOT_EXECUTE()'));assert.ok(!sheet.includes('<f>'));assert.ok(E.describe(t.rules[0].assertion,t).includes('Plant → Plant'));});


test('correction suggestions preserve tuple context, leading zeros and searchable descriptions without mutation',()=>{
 const t=tupleSchema(),r={PLANT:'0001',SLOC:'wrong'},before=copy(r);t.lookups[0].rows.push(['0001','0010','Secondary stock','Spare parts']);
 let s=E.suggestions(t,r,'SLOC');assert.deepEqual(copy(s.choices.map(c=>c.value)),['0010','A1']);assert.deepEqual(copy(r),before);assert.deepEqual(copy(E.suggestions(t,r,'SLOC','spare').choices.map(c=>c.value)),['0010']);
 assert.equal(E.suggestions(t,{PLANT:'1',SLOC:'wrong'},'SLOC').total,0);assert.equal(E.suggestions(t,{PLANT:'',SLOC:'wrong'},'SLOC').total,0);assert.equal(E.suggestions(t,{PLANT:'0002',SLOC:'B1'},'SLOC').total,0);
});
test('correction suggestions obey allowed values, applicable assertions and enabled reference rules',()=>{
 const t=tupleSchema();t.columns[1].values='A1,A2';t.lookups[0].rows.push(['0001','A2','Extra','Other']);const r=E.rule('SLOC');r.assertion={...E.condition('SLOC'),operator:'eq',value:'A2'};t.rules.push(r);
 assert.deepEqual(copy(E.suggestions(t,{PLANT:'0001',SLOC:'wrong'},'SLOC').choices.map(c=>c.value)),['A2']);t.rules[1].enabled=false;assert.equal(E.suggestions(t,{PLANT:'0001',SLOC:'a1'},'SLOC').total,1);
});

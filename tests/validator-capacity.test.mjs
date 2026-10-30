import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});
for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-transform.js','validator-files.js'])w.eval(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles;
test.after(()=>w.close());
const input=async zip=>{const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});return {name:'large.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()};};
const minimal=xml=>{const zip=new w.JSZip();zip.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>');zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>');zip.file('xl/worksheets/sheet1.xml',xml);return zip;};

test('CSV and full-file validation accept 25,000 records at 200 columns and find distant duplicates',()=>{
 const schema=E.create('Large upload');schema.columns=Array.from({length:200},(_,i)=>({...E.column(i),key:'F'+i,label:'F'+i,unique:i===0}));schema.rules=[];
 const header=schema.columns.map(c=>c.key),line=header.map((_,i)=>i?'x':'000001');
 const csv=[header.join(','),...Array.from({length:25000},(_,i)=>[String(i===24999?0:i).padStart(6,'0'),...line.slice(1)].join(','))].join('\n');
 const parsed=E.parseCSV(csv);assert.equal(parsed.length,25001);assert.equal(parsed.at(-1).length,200);
 const mapped=E.mapRows(header,parsed.slice(1),schema,E.autoMap(header,schema)),result=E.validateRows(schema,mapped);
 assert.equal(result.rows,25000);assert.equal(result.errors,2);assert.deepEqual(Array.from(result.issues,i=>i.index),[0,24999]);
 assert.throws(()=>E.parseCSV(csv+'\n'+line.join(',')),/5,000,000 data cells/);assert.throws(()=>E.validateRows(schema,[...mapped,mapped[0]]),/25,000 rows/);
 const comparison=F.comparison(schema,{headers:header,mapping:E.autoMap(header,schema),originalRows:parsed.slice(1),preparedRows:parsed.slice(1),sourceRows:parsed.slice(1),origins:Array.from({length:25000},(_,i)=>({row:i+2,part:''})),headerRow:1,sheet:'Data',steps:[]},result);
 assert.equal(comparison.rows.length,25000);assert.equal(comparison.fields.length,200);assert.equal(comparison.changedCells,0);assert.equal(F.comparisonCell(comparison,24999,199).current,'x');
});

test('incremental XLSX reading handles 12,001 records and large UTF-8 text without losing boundary values',async()=>{
 const values=Array.from({length:12002},(_,i)=>'<row r="'+(i+1)+'"><c r="A'+(i+1)+'" t="inlineStr"><is><t>'+String(i).padStart(8,'0')+'</t></is></c><c r="B'+(i+1)+'" t="inlineStr"><is><t>'+('界 &amp; café '.repeat(18))+i+'</t></is></c></row>');
 const zip=minimal('<worksheet><sheetData>'+values.join('')+'</sheetData></worksheet>');const book=await F.read(await input(zip));assert.equal(book.sheets[0].rows.length,12002);assert.equal(book.sheets[0].rows[12001][0],'00012001');assert.equal(book.sheets[0].rows[12001][1],('界 & café '.repeat(18))+'12001');
});

test('incremental reader preserves XML checks and rejects invalid or duplicate addresses',async()=>{
 for(const [body,pattern]of [['<row><c r="A0"><v>1</v></c></row>',/25,000 data rows/],['<row><c r="A1"><v>1</v></c><c r="A1"><v>2</v></c></row>',/duplicate cell/],['<row><c r="A1" t="s"><v>9</v></c></row>',/shared string/],['<row><c r="A1"><v>1</v></c>',/invalid XML/],['<!DOCTYPE worksheet><row/>',/entity declarations/]]){await assert.rejects(F.read(await input(minimal('<worksheet><sheetData>'+body+'</sheetData></worksheet>'))),pattern);}
});

test('large exports continue worksheets with headers and every record intact in a CRC-valid archive',async()=>{
 const width=200,count=5101;const blob=await F.workbook([{name:'Original upload',width,rowCount:count+1,rows:function*(){yield Array.from({length:width},(_,i)=>'F'+i);for(let i=0;i<count;i++)yield Array.from({length:width},(_,j)=>i+':'+j);}}]);
 const zip=await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer()),{checkCRC32:true});const book=await zip.file('xl/workbook.xml').async('string');assert.ok(book.includes('Original upload 2'));
 const first=await zip.file('xl/worksheets/sheet1.xml').async('string'),last=await zip.file('xl/worksheets/sheet2.xml').async('string');assert.equal((first.match(/<row /g)||[]).length,5001);assert.equal((last.match(/<row /g)||[]).length,102);assert.ok(last.includes('F199'));assert.ok(last.includes('5100:199'));assert.equal(first.includes('5000:0'),false);
});

test('large comparison workbooks retain every field, original value, correction and highlight',async()=>{
 const schema=E.create('Wide comparison');schema.columns=Array.from({length:42},(_,i)=>({...E.column(i),key:'F'+i,label:'Field '+i,values:i===1?'valid':''}));schema.rules=[];
 const headers=schema.columns.map(c=>c.label),original=Array.from({length:1200},(_,i)=>headers.map((_,j)=>j===1?'valid':String(i).padStart(6,'0'))),prepared=original.map(r=>r.slice()),current=original.map(r=>r.slice());prepared[0][1]='prepared';current[0][1]='corrected';
 const mapping=E.autoMap(headers,schema),rows=E.mapRows(headers,current,schema,mapping),result=E.validateRows(schema,rows),upload={headers,mapping,originalRows:original,preparedRows:prepared,sourceRows:current,origins:current.map((_,i)=>({row:i+2,part:''})),headerRow:1,sheet:'Source',fileName:'wide.csv',steps:[],comparisonFirst:true};
 const blob=await F.report(schema,rows,result,false,upload),zip=await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer()),{checkCRC32:true}),book=new w.DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'),'application/xml');
 const names=Array.from(book.getElementsByTagName('sheet'),n=>n.getAttribute('name')),index=names.indexOf('Field comparison')+1,xml=await zip.file('xl/worksheets/sheet'+index+'.xml').async('string');assert.equal((xml.match(/<row /g)||[]).length,1201);assert.ok(xml.includes('F41 · Validated'));assert.ok(xml.includes('F1 · Original'));assert.ok(xml.includes('prepared'));assert.ok(xml.includes('corrected'));assert.ok(xml.includes('001199'));assert.match(xml,/<c r="M2" s="2" t="inlineStr"><is><t xml:space="preserve">corrected/);
});


test('bounded XML parsing preserves namespaces declared around rows and literal CDATA',async()=>{
 const zip=minimal('<worksheet><sheetData xmlns:m="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><!-- <row r="99">ignored</row> --><m:row><m:c r="A1" t="inlineStr"><m:is><m:t><![CDATA[<row> & 00001]]></m:t></m:is></m:c></m:row></sheetData></worksheet>');
 const book=await F.read(await input(zip));assert.equal(book.sheets[0].rows[0][0],'<row> & 00001');
});

// Fixed inputs for comparing optimizations with the deployed validation semantics.
export function parityCases(E) {
 const out=[],ops=Object.keys(E.OPS),texts=['',' ','0001','0002','A','a','  A  ','X,Y','=1+1','<x>','A&B','TRUE','false'],numbers=['','0','-0','1','-2','2.50','1e2','x','9007199254740993','1,000'],dates=['','2026-10-01','2026-02-29','2024-02-29','00000000','20261001'];
 let seed=48157;const pick=a=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a[seed%a.length]};
 for(const mode of ['general','sap'])for(let variant=0;variant<12;variant++){
  const t=E.create('Parity '+mode+' '+variant);t.id='template';t.mode=mode;
  t.columns=[['TEXT','text','CHAR',20],['CODE','text','NUMC',4],['NUM','decimal','DEC',18],['DATE','date','DATS',8],['OTHER','text','CHAR',20],['BOOL','boolean','CHAR',8]].map(([key,type,sapType,sapLength],i)=>({...E.column(i),id:'column-'+i,key,label:key,type,sapType,sapLength,sapDecimals:sapType==='DEC'?4:'',trim:variant%3!==0,caseSensitive:variant%2===0,required:i===0&&variant%2===0,values:i===4?'A,B,0001':''}));
  t.lookups=[{id:'ref',name:'Reference',headers:['Code','Name','Other'],rows:[['0001','First','A'],['0002','Second','B'],['','Blank',''],['A','Letter','A']],codeColumn:'Code',nameColumn:'Name',descriptionColumns:['Other']}];
  t.columnGroups=[{id:'group',name:'Choices',fields:['TEXT'],sets:[{id:'set',name:'Set',values:{TEXT:'A,B'}}]}];
  t.rules=ops.map((operator,i)=>{const r=E.rule('TEXT');r.id='rule-'+i;r.name='Rule '+operator;r.enabled=i%7!==variant%7;r.severity=i%3?'error':'warning';r.message=i%5?'':'Shared message';r.when={join:i%2?'all':'any',conditions:[{...E.condition('OTHER'),operator:'neq',value:'no-match'},{...E.condition('TEXT'),operator:'notEmpty'}],groups:[{join:'any',conditions:[{...E.condition('CODE'),operator:'eq',value:'0001'},{...E.condition('TEXT'),operator:'empty'}],groups:[]}]};r.assertion={...E.condition('TEXT'),operator,value:['in','notIn'].includes(operator)?'A,B':operator==='pattern'?'alphanumeric':'A',otherField:'OTHER',lookupId:'ref',lookupColumn:'Other'};if(operator==='lookupTuple')r.assertion.pairs=[{field:'TEXT',referenceColumn:'Other'},{field:'CODE',referenceColumn:'Code'}];if(i===0)r.additionalAssertions=[{...E.condition('TEXT'),operator:'in',valueSource:'group',groupId:'group',valueSetId:'set'},{...E.condition('OTHER'),operator:'notEmpty'}];return r});
  if(variant%3===0){t.projectId='project';t.rules[0].companyScope='selected';t.rules[0].companies=[{id:'alpha',name:'Alpha'}];}
  t.uniqueGroups=[['TEXT','CODE']];t.columns[1].unique=true;
  const rows=Array.from({length:180},()=>({TEXT:pick(texts),CODE:pick(mode==='sap'?['0001','0002','','A','001']:texts),NUM:pick(numbers),DATE:pick(mode==='sap'?['','00000000','20261001','20260229','20240229','00010101']:dates),OTHER:pick(texts),BOOL:pick(['','true','false','yes','no','1','0','maybe'])}));
  out.push({name:mode+'-'+variant,t,rows,context:t.projectId?{projectId:'project',companyId:variant%2?'alpha':'beta'}:{}});
 }
 const edge=E.create('Allowed-value boundaries');edge.columns=[['NUM','integer','invalid,0,0.001'],['BOOL','boolean','maybe,true,false'],['TEXT','text','A, B'],['EMPTY','text',' , '],['BIG','decimal','1e309,9007199254740993']].map(([key,type,values],i)=>({...E.column(i),id:'edge-'+i,key,label:key,type,values,trim:key!=='TEXT',caseSensitive:key==='TEXT'}));out.push({name:'allowed-value-boundaries',t:edge,rows:Array.from({length:6},(_,i)=>({NUM:['bad','1','0.001','0','-0',''][i],BOOL:['unknown','true','false','maybe','0',''][i],TEXT:['A',' A ','b','B','',' '][i],EMPTY:['X','',' ','A','0','B'][i],BIG:['bad','1e309','9007199254740993','-0','','0'][i]})),context:{}});
 const t=E.create('Truncated');t.columns=[{...E.column(0),key:'ID',label:'Identifier',values:'A',unique:true}];out.push({name:'truncated-duplicates',t,rows:Array.from({length:16010},()=>({ID:'B'})),context:{}});
 return out;
}

export function workbookCases(E) {
 const cases=[{name:'mixed-workbook',sheets:[{name:'Values & styles',width:5,rowCount:4,rows:[['Code','Number','Date','Text','Flag'],['0001',0,{value:45600,style:5},'=literal',false],['<&>"\'','-0',{value:'invalid',style:2},'line\none',true],[' A ',123.45,null,{value:'warn',style:3},'trailing','Beyond width']]}]}];
 const [general,...rest]=parityCases(E),sap=rest.find(c=>c.name==='sap-0');
 for(const c of [general,sap]){
  const headers=c.t.columns.map(column=>column.key),originalRows=c.rows.map(row=>headers.map(key=>String(row[key]??''))),preparedRows=originalRows.map(row=>row.slice());preparedRows[0][0]='prepared';
  const upload={headers,originalRows,preparedRows,sourceRows:originalRows.map(row=>row.slice()),origins:originalRows.map((_,i)=>({row:i+2,part:i%7?'':'1'})),mapping:Object.fromEntries(headers.map((key,i)=>[key,i])),headerRow:1,sheet:'Source',fileName:'original.csv',steps:[{kind:'explode',rows:c.rows.length,changes:1}],comparisonFirst:true};
  cases.push({name:c.name+'-full',t:c.t,rows:c.rows,context:c.context,upload},{name:c.name+'-accepted',t:c.t,rows:c.rows,context:c.context,upload,accepted:true},{name:c.name+'-template',t:c.t,template:true});
 }
 return cases;
}

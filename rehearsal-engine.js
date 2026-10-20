/** Personal process rehearsals: bounded graph playback and sample values, never SAP posting. */
(function rehearsalEngine(root) {
  'use strict';
  const TYPES=['task','document','decision','approval','result'], THEMES=['desk','blueprint','control'];
  const copy=v=>JSON.parse(JSON.stringify(v)), text=(v,max=32767)=>typeof v==='string'&&v.length<=max;
  const reserved=new Set(['__proto__','prototype','constructor']);
  const fieldOK=k=>text(k,80)&&k.trim()&&!reserved.has(k);
  const stamp=v=>text(v,50)&&!!v&&Number.isFinite(Date.parse(v));
  const link=v=>v===''||(text(v,2000)&&/^https?:\/\/[^\s<>"]+$/i.test(v));
  function values(raw) {
    const out={};
    for(const line of String(raw||'').split('\n').filter(l=>l.trim())) {
      const at=line.indexOf('='), k=line.slice(0,at).trim(), s=line.slice(at+1).trim();
      if(at<1||!fieldOK(k)||Object.hasOwn(out,k)) throw Error('Use one unique field = value per line.');
      out[k]=/^-?\d+(\.\d+)?$/.test(s)?Number(s):s;
    }
    checkValues(out);return out;
  }
  function checkValues(v) {
    if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>30) throw Error('Use up to 30 sample fields.');
    for(const [k,x]of Object.entries(v))if(!fieldOK(k)||!(text(x,300)||(typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12)))throw Error('Check the sample field values.');
  }
  function changes(raw) {
    return String(raw||'').split('\n').filter(l=>l.trim()).map(line=>{
      const m=line.match(/^(.+?)\s*(\+=|=)\s*(.*?)\s*$/);
      if(!m||!fieldOK(m[1].trim()))throw Error('Use Field = value or Field += number / @Other field.');
      const s=m[3], value=/^-?\d+(\.\d+)?$/.test(s)?Number(s):s;
      return {field:m[1].trim(),operator:m[2]==='+='?'add':'set',value};
    });
  }
  function upgrade(d) {
    if(!d.workhub)d.workhub={};
    if(d.workhub.rehearsal===undefined)d.workhub.rehearsal={version:1,processes:[],preferences:{sound:true,volume:0.22,speed:1,effects:'expressive',theme:'desk',explore:true}};
    return d;
  }
  function validate(d) {
    const h=d.workhub.rehearsal,p=h?.preferences;
    if(!h||h.version!==1||!Array.isArray(h.processes)||h.processes.length>100||!p||
      typeof p.sound!=='boolean'||typeof p.explore!=='boolean'||!THEMES.includes(p.theme)||!['quiet','balanced','expressive'].includes(p.effects)||
      ![0.5,1,1.5,2].includes(p.speed)||!Number.isFinite(p.volume)||p.volume<0||p.volume>1)throw Error('Check rehearsal preferences.');
    const ids=new Set();let imageBytes=0,totalSteps=0;
    for(const process of h.processes) {
      if(!text(process.id,100)||!process.id||ids.has(process.id)||!text(process.name,300)||!process.name.trim()||!text(process.notes)||
        !stamp(process.createdAt)||!stamp(process.updatedAt)||!Array.isArray(process.steps)||!process.steps.length||process.steps.length>80||
        !Array.isArray(process.scenarios)||!process.scenarios.length||process.scenarios.length>20)throw Error('Check the saved process.');
      ids.add(process.id);totalSteps+=process.steps.length;
      const stepIds=new Set(process.steps.map(s=>s.id));if(stepIds.size!==process.steps.length||!stepIds.has(process.startId))throw Error('Choose a unique starting step.');
      for(const s of process.steps) {
        if(!text(s.id,100)||!s.id||!text(s.title,300)||!s.title.trim()||!TYPES.includes(s.type)||!text(s.tcode,40)||
          !text(s.owner,200)||!text(s.instruction)||!text(s.prerequisites)||!text(s.expected)||!text(s.failure)||
          !link(s.link)||!text(s.image,180000)||(s.image&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s.image))||
          !Number.isFinite(s.x)||s.x<0||s.x>4000||!Number.isFinite(s.y)||s.y<0||s.y>4000||
          !Number.isFinite(s.duration)||s.duration<0||s.duration>30||(s.duration>0&&s.duration<2)||
          !text(s.next,100)||!text(s.failNext,100)||(s.next&&!stepIds.has(s.next))||(s.failNext&&!stepIds.has(s.failNext))||
          !Array.isArray(s.changes)||s.changes.length>30)throw Error('Check the process steps, connections or screenshot size.');
        imageBytes+=s.image.length;
        for(const c of s.changes)if(!fieldOK(c.field)||!['set','add'].includes(c.operator)||!(text(c.value,300)||(typeof c.value==='number'&&Number.isFinite(c.value)&&Math.abs(c.value)<=1e12)))throw Error('Check step value changes.');
      }
      const scenarios=new Set();
      for(const s of process.scenarios) {
        if(!text(s.id,100)||!s.id||scenarios.has(s.id)||!text(s.name,200)||!s.name.trim()||!text(s.notes)||
          !s.choices||typeof s.choices!=='object'||Array.isArray(s.choices))throw Error('Check process scenarios.');
        scenarios.add(s.id);checkValues(s.initial);
        for(const [id,outcome]of Object.entries(s.choices))if(!stepIds.has(id)||!['success','failure'].includes(outcome))throw Error('Choose a valid scenario branch.');
      }
    }
    if(totalSteps>2000||imageBytes>2*1024*1024)throw Error('Rehearsals support 2,000 steps and 2 MB of optimized screenshots in total.');
  }
  function apply(before,list) {
    const result=copy(before),diff=[];
    for(const c of list) {
      if(!fieldOK(c.field))throw Error('Invalid sample field.');
      const value=typeof c.value==='string'&&c.value.startsWith('@')?result[c.value.slice(1)]:c.value;
      if(value===undefined)throw Error('Missing sample field: '+String(c.value).slice(1));
      const old=Object.hasOwn(result,c.field)?result[c.field]:0;
      if(c.operator==='add'&&(typeof value!=='number'||typeof old!=='number'))throw Error('Numeric addition needs numeric sample fields.');
      result[c.field]=c.operator==='add'?old+value:value;diff.push({field:c.field,before:old,after:result[c.field]});
    }
    checkValues(result);return {values:result,changes:diff};
  }
  function plan(process,scenario,overrides={}) {
    const map=new Map(process.steps.map(s=>[s.id,s])), entries=[],visits=new Map();let current=process.startId,state=copy(scenario.initial),ending='complete';
    while(current) {
      const s=map.get(current);if(!s){ending='missing';break;}
      const times=(visits.get(current)||0)+1;visits.set(current,times);
      if(times>4||entries.length>=160){ending='loop-guard';break;}
      const outcome=overrides[s.id]||scenario.choices[s.id]||'success',before=copy(state),
        applied=outcome==='failure'?{values:before,changes:[]}:apply(before,s.changes),
        nextId=outcome==='failure'?s.failNext:s.next;
      state=applied.values;
      entries.push({id:s.id,type:s.type,title:s.title,outcome,before,values:copy(state),changes:applied.changes,nextId,
        instruction:outcome==='failure'?(s.failure||'This sample step failed.'):(s.instruction||s.expected),
        duration:s.duration||Math.max(3,Math.min(16,3+(s.instruction+s.expected).split(/\s+/).length/3.5))});
      if(outcome==='failure'&&!nextId)ending='failed';
      current=nextId;
    }
    return {entries,ending,values:copy(state)};
  }
  function layout(process) {
    const nodes=new Map(process.steps.map(s=>[s.id,s])), depth=new Map([[process.startId,0]]), queue=[process.startId], rows=new Map();
    while(queue.length) {
      const id=queue.shift(),s=nodes.get(id);if(!s)continue;
      for(const next of [s.next,s.failNext])if(next&&nodes.has(next)&&!depth.has(next)){depth.set(next,Math.min(14,depth.get(id)+1));queue.push(next);}
    }
    let spare=0;const occupied=new Set();
    for(const s of process.steps) {
      const preferred=depth.has(s.id)?depth.get(s.id):spare++%4,n=rows.get(preferred)||0;rows.set(preferred,n+1);
      let col=(preferred+Math.floor(n/20))%15,row=n%20;
      while(occupied.has(col+':'+row)){col=(col+1)%15;if(col===0)row=(row+1)%20;}
      occupied.add(col+':'+row);s.x=50+col*260;s.y=55+row*180;
    }
    return process;
  }
  function seed(id,now,blank=false) {
    const step=(sid,title,type,next='',extra={})=>({id:sid,title,type,tcode:'',owner:'Me',instruction:'',prerequisites:'',expected:'',failure:'',link:'',image:'',x:0,y:0,duration:0,next,failNext:'',changes:[],...extra});
    const p={id,name:blank?'My new process':'Procure to pay · personal rehearsal',notes:'Sample learning flow. Values and routes follow your definitions; nothing is posted to SAP.',startId:'po',createdAt:now,updatedAt:now,
      steps:blank?[step('po','First step','task','finish'),step('finish','Finished','result')]:[
        step('po','Create purchase order','document','approve',{tcode:'ME21N',instruction:'Review the supplier, material, quantity and agreed price. Save the sample purchase order.',expected:'A purchase order is ready for release.',changes:[{field:'Ordered quantity',operator:'set',value:100},{field:'Order value',operator:'set',value:1000}]}),
        step('approve','Approve the order','approval','gr',{instruction:'Check the order and choose the route for this rehearsal.',expected:'The sample order is approved.',failure:'Approval was rejected. Review the order before trying again.',failNext:'rework',changes:[{field:'PO status',operator:'set',value:'Approved'}]}),
        step('gr','Receive the delivery','document','match',{tcode:'MIGO',instruction:'Check the delivered quantity and record the sample goods receipt.',expected:'Stock and received quantity are updated.',changes:[{field:'Received quantity',operator:'add',value:'@Delivery quantity'}]}),
        step('match','Does the delivery match?','decision','invoice',{instruction:'Inspect ordered and received quantities. Choose your defined normal or exception route.',expected:'Continue using the route saved for this scenario.',failure:'The delivery is partial. Follow up before continuing.',failNext:'followup'}),
        step('invoice','Verify supplier invoice','document','finish',{tcode:'MIRO',instruction:'Compare the invoice with the sample order and receipt.',expected:'Invoice verification is complete for this example.',changes:[{field:'Invoice status',operator:'set',value:'Verified'}]}),
        step('finish','Process complete','result','',{instruction:'Review the final values and the rehearsal journal.',expected:'This sample route is complete.'}),
        step('rework','Revise rejected order','task','approve',{tcode:'ME22N',instruction:'Correct the sample order and request another review.',changes:[{field:'PO status',operator:'set',value:'Revised'}]}),
        step('followup','Follow up remaining delivery','task','invoice',{instruction:'Record the partial-delivery follow-up. This illustrative route continues to invoice review; adapt it to your process.',changes:[{field:'Follow-up',operator:'set',value:'Delivery owner contacted'}]})
      ],
      scenarios:blank?[{id:'normal',name:'Normal route',notes:'',initial:{},choices:{}}]:[
        {id:'normal',name:'Normal flow',notes:'Full delivery and approval.',initial:{'Delivery quantity':100,'Received quantity':0,'PO status':'Draft'},choices:{}},
        {id:'partial',name:'Partial delivery',notes:'An explicitly defined exception route.',initial:{'Delivery quantity':60,'Received quantity':0,'PO status':'Draft'},choices:{match:'failure'}},
        {id:'rejected',name:'Approval rejection',notes:'Revisit the approval until the bounded loop guard stops this sample. Choose Success during playback to recover.',initial:{'Delivery quantity':100,'Received quantity':0,'PO status':'Draft'},choices:{approve:'failure'}}
      ]};
    return layout(p);
  }
  function point(a,b,t) {
    const x1=a.x+210,y1=a.y+50,x2=b.x,y2=b.y+50,k=Math.max(70,Math.abs(x2-x1)*0.45),u=1-t;
    return {x:u*u*u*x1+3*u*u*t*(x1+k)+3*u*t*t*(x2-k)+t*t*t*x2,y:u*u*u*y1+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y2};
  }
  function path(a,b) {const k=Math.max(70,Math.abs(b.x-a.x-210)*0.45);return `M ${a.x+210} ${a.y+50} C ${a.x+210+k} ${a.y+50}, ${b.x-k} ${b.y+50}, ${b.x} ${b.y+50}`;}
  root.WorkHubRehearsalEngine={TYPES,THEMES,upgrade,validate,values,changes,apply,plan,layout,seed,point,path,copy};
})(window);

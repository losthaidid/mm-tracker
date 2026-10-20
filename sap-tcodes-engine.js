/** SAP T-code library: private edits, version filtering and validated references. */
(function sapTcodeEngine(root) {
  'use strict';
  const copy = v => JSON.parse(JSON.stringify(v));
  const text = (v,max=32767) => typeof v==='string' && v.length<=max;
  const link = v => v==='' || (text(v,2000) && /^https?:\/\/[^\s<>"]+$/i.test(v));
  function upgrade(d) {
    if (!d.workhub) d.workhub={};
    if (d.workhub.tcodes===undefined) d.workhub.tcodes={version:1,records:copy(root.WorkHubSapTcodeData.rows)};
    return d;
  }
  function validate(d) {
    const h=d.workhub.tcodes;
    if (!h || h.version!==1 || !Array.isArray(h.records) || h.records.length>2000) throw Error('Check the T-code library.');
    const ids=new Set(), codes=new Set();
    for (const r of h.records) {
      if (!r || !text(r.id,100) || !r.id || ids.has(r.id) || !text(r.code,40) || !/^[A-Z0-9_/]+$/.test(r.code) || codes.has(r.code) ||
          !text(r.title,300) || !r.title.trim() || !text(r.category,80) || !r.category.trim() || !text(r.area,100) ||
          !Array.isArray(r.systems) || !r.systems.length || new Set(r.systems).size!==r.systems.length || r.systems.some(s=>!['ECC','S4'].includes(s)) ||
          !text(r.eccNote) || !text(r.s4Note) || !text(r.notes) || typeof r.favorite!=='boolean' || typeof r.archived!=='boolean' ||
          !text(r.sourceTitle,300) || !link(r.sourceUrl) || !['starter','personalised','custom'].includes(r.origin) ||
          !text(r.checkedAt,10) || !text(r.updatedAt,50)) throw Error('Check the T-code details. Codes must be unique.');
      ids.add(r.id);codes.add(r.code);
    }
  }
  function query(d,filters={}) {
    const q=(filters.query||'').trim().toLowerCase();
    return d.workhub.tcodes.records.filter(r=>(filters.archived?r.archived:!r.archived) &&
      (!filters.system || r.systems.includes(filters.system)) && (!filters.category || r.category===filters.category) &&
      (!filters.favorite || r.favorite) && (!q || [r.code,r.title,r.area,r.notes,r.eccNote,r.s4Note].some(v=>v.toLowerCase().includes(q))))
      .sort((a,b)=>{const order=['Transactions','Reporting','Master data','Configuration','Support'],rank=c=>order.includes(c)?order.indexOf(c):99;return rank(a.category)-rank(b.category)||a.category.localeCompare(b.category)||Number(b.favorite)-Number(a.favorite)||a.code.localeCompare(b.code);});
  }
  root.WorkHubSapTcodesEngine={upgrade,validate,query};
})(window);

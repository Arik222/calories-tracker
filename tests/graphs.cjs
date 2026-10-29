const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{style:{},classList:{toggle(){}},setAttribute(){},getContext(){return id;}});return elements.get(id);};
const charts=[];
const ctx=vm.createContext({document:{getElementById:element},window:{matchMedia:()=>({matches:true})},formatDateHebrew:x=>x,Chart:class{constructor(canvas,config){this.config=config;charts.push(this);}destroy(){this.destroyed=true;}}});
vm.runInContext(source.slice(source.indexOf('  const pulseCharts ='),source.indexOf('  async function loadAndRenderGraphs()')),ctx);
const rows=Array.from({length:45},(_,i)=>({date:`2026-${String(Math.floor(i/28)+1).padStart(2,'0')}-${String(i%28+1).padStart(2,'0')}`,balance:(i%5-2)*137}));
ctx.renderPulseCharts(rows);
for(const [i,key,limit]of [[0,'week',7],[1,'month',30],[2,'all',45]]){
const selected=rows.slice(-limit),total=selected.reduce((sum,r)=>sum+r.balance,0);
assert.deepEqual(Array.from(charts[i].config.data.datasets[0].data),selected.map(r=>r.balance));
assert.equal(element('pulseTotal-'+key).textContent,(total>=0?'+':'')+total);
assert.equal(element('pulseKg-'+key).textContent,parseFloat((Math.abs(total)/7700).toFixed(2)));
assert.equal(element('pulseAvg-'+key).textContent,(Math.round(total/limit)>=0?'+':'')+Math.round(total/limit)+' קל׳');
}
ctx.renderPulseCharts(rows.slice(0,1));assert.ok(charts.slice(0,3).every(chart=>chart.destroyed));
ctx.clearPulseCharts();assert.equal(element('pulseSection').style.display,'none');
assert.equal(fs.readFileSync('www/index.html','utf8'),source);
console.log('Additional graph ranges, balances, kg conversion, averages and chart cleanup passed');

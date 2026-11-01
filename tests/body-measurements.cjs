const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync('index.html','utf8');
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.setContent(source.replace(/<script[\s\S]*?<\/script>/g,''));
 await page.addScriptTag({content:`
 let currentUser={id:'test-user'};
 function formatDateHebrew(s){return s.split('-').reverse().join('/');}
 class Chart { constructor(canvas, config){this.config=config;} destroy(){} }
 const rows=[]; let fail=false; let replaceAllowed=true;
 window.confirm=()=>replaceAllowed;
 const db={from(table){if(table!=='body_measurements')throw Error('Wrong table');let filters={},payload,mode='read';return {
 select(){return this;},eq(k,v){filters[k]=v;return this;},order(){return this;},maybeSingle(){mode='single';return this;},
 update(p){payload=p;mode='update';return this;},insert(p){payload=p;mode='insert';return this;},
 async throwOnError(){if(fail)throw Error('offline');let matches=rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
 if(mode==='insert'){rows.push(payload);return {};}
 if(mode==='update'){matches.forEach(r=>Object.assign(r,payload));return {};}
 return {data:mode==='single'?matches[0]||null:[...matches].sort((a,b)=>a.measured_on.localeCompare(b.measured_on))};}
 };}};
 `+source.slice(source.indexOf('  // ─── Dated body measurements'),source.indexOf('  // ─── Profile (calorie target)'))});
 await page.evaluate(async()=>{
 await loadBodyMeasurements();
 document.getElementById('measurementDate').value='2026-09-01';
 document.getElementById('measurement-abdomen').value='98.5';
 document.getElementById('measurement-arm').value='32';
 await saveBodyMeasurement();
 newBodyMeasurement();document.getElementById('measurementDate').value='2026-10-01';document.getElementById('measurement-abdomen').value='96.1';
 await saveBodyMeasurement();
 });
 let result=await page.evaluate(()=>({count:rows.length,delta:measurementDelta([98.5,96.1]),history:document.getElementById('measurementHistory').textContent,values:bodyMeasurementChart.config.data.datasets[0].data}));
 assert.equal(result.count,2);assert.equal(result.delta,-2.4);assert.deepEqual(result.values,[98.5,96.1]);assert.match(result.history,/01\/09\/2026/);
 await page.evaluate(async()=>{newBodyMeasurement(rows[1]);document.getElementById('measurement-abdomen').value='95';replaceAllowed=false;await saveBodyMeasurement();});
 assert.equal(await page.evaluate(()=>rows[1].abdomen_cm),96.1);
 await page.evaluate(async()=>{replaceAllowed=true;await saveBodyMeasurement();});assert.equal(await page.evaluate(()=>rows[1].abdomen_cm),95);assert.equal(await page.evaluate(()=>rows.length),2);
 await page.evaluate(async()=>{fail=true;document.getElementById('measurement-abdomen').value='94';await saveBodyMeasurement();});
 assert.match(await page.locator('#measurementStatus').textContent(),/לא נשמרה/);assert.equal(await page.locator('#measurement-abdomen').inputValue(),'94');assert.equal(await page.locator('#measurementSave').isEnabled(),true);
 await page.evaluate(()=>{newBodyMeasurement();});await page.evaluate(()=>saveBodyMeasurement());assert.match(await page.locator('#measurementStatus').textContent(),/לפחות היקף/);
 await page.evaluate(async()=>{fail=false;currentUser={id:'another-user'};await loadBodyMeasurements();});assert.equal(await page.locator('#measurementResults').isVisible(),false);
 // Restore simulated records for visual inspection; no production data is written.
 await page.evaluate(async()=>{currentUser={id:'test-user'};await loadBodyMeasurements();document.getElementById('loadingOverlay').style.display='none';document.getElementById('authScreen').style.display='none';document.getElementById('appScreen').style.display='block';document.getElementById('trackerView').style.display='none';document.getElementById('settingsView').style.display='block';});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#measurementsPanel').screenshot({path:'/tmp/body-measurements-mobile.png'});
 assert.equal(fs.readFileSync('www/index.html','utf8'),source);
 console.log('Body measurements: dated history, partial values, chart data, decimal delta, overwrite confirmation, save failure, validation, user isolation and mobile layout passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

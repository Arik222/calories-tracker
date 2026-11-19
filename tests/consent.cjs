const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{style:{},textContent:'',disabled:false});return elements.get(id);}
const records=[];let readError=false,writeError=false,shown=0,insertions=0;
const ctx=vm.createContext({
 currentUser:{id:'returning-user'}, TERMS_VERSION:'2026-04-16',
 document:{getElementById:element,querySelector:()=>null},hideLoading(){},showApp(){shown++;},console:{error(){}},
 db:{auth:{async signOut(){}},from(table){assert.equal(table,'user_terms_consents');const filters={};let take=null,payload=null;return {
 select(){return this;},eq(k,v){filters[k]=v;return this;},limit(n){take=n;return this;},insert(row){payload=row;return this;},
 then(resolve,reject){return Promise.resolve().then(()=>{
 if(payload){if(writeError)return {error:{code:'42501'}};records.push({...payload,id:++insertions});return {error:null};}
 if(readError)throw Error('offline');
 assert.equal(take,1,'Consent lookup must be bounded and tolerate duplicate records');
 return {data:records.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)).slice(0,take),error:null};
 }).then(resolve,reject);}
 };}}
});
vm.runInContext(source.slice(source.indexOf('  let consentSaving ='),source.indexOf('  async function loadAndShowApp()')),ctx);
(async()=>{
 records.push({id:1,user_id:'returning-user',terms_version:'2026-04-16'},{id:2,user_id:'returning-user',terms_version:'2026-04-16'});
 assert.equal(await ctx.checkConsentGate(),true,'Existing duplicate consents must not prompt again');
 assert.equal(await ctx.checkConsentGate(),true,'Repeated login recognizes prior approval');
 assert.equal(element('consentGateModal').style.display,'none');
 await ctx.agreeToConsentGate();assert.equal(insertions,0,'Existing approval must not be duplicated');assert.equal(shown,1);
 ctx.currentUser={id:'new-user'};
 assert.equal(await ctx.checkConsentGate(),false);assert.equal(element('consentGateModal').style.display,'flex','Approval remains per account');
 await Promise.all([ctx.agreeToConsentGate(),ctx.agreeToConsentGate()]);assert.equal(insertions,1,'Double clicks insert once');
 assert.equal(await ctx.checkConsentGate(),true,'Approval is recognized after reload');
 ctx.TERMS_VERSION='future-version';assert.equal(await ctx.checkConsentGate(),false,'A different terms version still requires consent');
 readError=true;assert.equal(await ctx.checkConsentGate(),false);assert.equal(element('consentGateModal').style.display,'none','Read failure is not a new consent request');assert.equal(element('consentLoadError').style.display,'flex');
 readError=false;writeError=true;const before=shown;await ctx.agreeToConsentGate();assert.equal(shown,before);assert.match(element('consentSaveError').textContent,/לא ניתן לשמור/);assert.equal(element('consentAgreeButton').disabled,false);
 assert.equal(fs.readFileSync('www/index.html','utf8'),source);
 for(const script of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
 console.log('Consent checks passed: duplicates, repeat logins, user/version isolation, double clicks, read/save errors and button recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});

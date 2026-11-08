import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './local-db.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url=process.argv[2]||'http://127.0.0.1:4173';
const local=url.startsWith('http://127.0.0.1:');
const directory=path.join(root,'artifacts',local?'local':'live');await fs.mkdir(directory,{recursive:true});
const profile=path.join(root,'.local','browser-profile');
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const errors=[];const results=[];
try{
 let port;for(let i=0;i<100;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await new Promise(r=>setTimeout(r,100));}if(!port)throw Error('Chrome did not start');
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl.replace('localhost','127.0.0.1'));
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=e=>reject(Error(e.message||'Browser connection failed'));});
 let next=1;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=next++;const timer=setTimeout(()=>reject(Error('Timed out: '+method)),15000);pending.set(id,{resolve:x=>{clearTimeout(timer);resolve(x)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Condition did not become true: '+expression);};
 const go=async route=>{await call('Page.navigate',{url:url+route});await until("document.readyState==='complete' && !!document.querySelector('.logo')");};
 const click=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"center",behavior:"instant"})');const r=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});};
 const fill=async(selector,value)=>evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');
 const capture=async name=>{const metrics=await call('Page.getLayoutMetrics');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}});await fs.writeFile(path.join(directory,name+'.png'),Buffer.from(shot.data,'base64'));};
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
 await go('/');assert.ok((await evaluate('document.title')).includes('Pitchmade'));
 for(const width of [1440,1024,768,390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await evaluate('scrollTo(0,0)');const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(layout.scroll<=width,'Horizontal overflow at '+width);results.push({viewport:width,overflow:false});if([1440,390].includes(width))await capture('landing-'+width);}
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await click('[data-slide="value"]');assert.equal(await evaluate("document.getElementById('deck-value').hidden"),false);
 await click('[data-slide="concept"]');
 await click('#privacy-open');assert.equal(await evaluate("document.getElementById('privacy-dialog').open"),true);await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate("document.getElementById('privacy-dialog').open"),false);
 await click('.faq-list summary');assert.equal(await evaluate("document.querySelector('.faq-list details').open"),true);
 await fill('#email','not-an-email');await click('#join-button');assert.equal(await evaluate("document.getElementById('signup-success').hidden"),true);assert.equal(await evaluate("document.getElementById('email').validity.typeMismatch"),true);
 const testEmail='browser-check-'+Date.now()+'@example.invalid';await fill('#email',testEmail);await click('#join-button');assert.equal(await evaluate("document.getElementById('consent').validity.valueMissing"),true);
 await click('#consent');await click('.optional summary');await fill('#platform','YouTube');await fill('#challenge','Synthetic QA: proving real email capture; remove after verification.');
 await call('Network.setBlockedURLs',{urls:[url+'/api/waitlist']});await click('#join-button');await until("document.getElementById('form-error').textContent.length>0");assert.equal(await evaluate("document.getElementById('signup-success').hidden"),true);assert.equal(await evaluate("document.getElementById('join-button').disabled"),false);results.push({networkFailure:'visible error, no false success, retry enabled'});
 await call('Network.setBlockedURLs',{urls:[]});await click('#join-button');await until("!document.getElementById('signup-success').hidden");await capture('signup-success-390');
 const managementLink=await evaluate("document.getElementById('manage-link').getAttribute('href')");assert.ok(managementLink?.startsWith('/manage#'));
 if(local){const db=openDatabase(path.join(root,'.local/waitlist.sqlite'));const row=db.sqlite.prepare('SELECT email,platform,challenge,consent_version FROM waitlist WHERE email=?').get(testEmail);assert.equal(row.email,testEmail);assert.equal(row.platform,'YouTube');db.close();results.push({capture:'Browser signup confirmed by direct SQLite read'});}
 // Repeat through the form to verify duplicate handling without granting someone else's removal token.
 await go('/');await fill('#email',testEmail);await click('#consent');await click('#join-button');await until("!document.getElementById('signup-success').hidden");assert.equal(await evaluate("document.getElementById('manage-link').hidden"),true);
 if(local){const db=openDatabase(path.join(root,'.local/waitlist.sqlite'));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM waitlist WHERE email=?').get(testEmail).n,1);db.close();}
 if(local){await go('/local-admin');assert.ok((await evaluate('document.body.textContent')).includes(testEmail));await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(root,'.local')});await click('a[href="/local-admin/export.csv"]');let csvText='';for(let i=0;i<40;i++){try{csvText=await fs.readFile(path.join(root,'.local/pitchmade-waitlist.csv'),'utf8');if(csvText.includes(testEmail))break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(csvText.includes(testEmail));await capture('owner-list-390');results.push({ownerView:'Browser owner list and CSV contain the real synthetic signup'});await go(managementLink);await click('#remove-signup');await until("document.getElementById('remove-signup').hidden");const db=openDatabase(path.join(root,'.local/waitlist.sqlite'));assert.equal(db.sqlite.prepare('SELECT count(*) n FROM waitlist WHERE email=?').get(testEmail).n,0);db.close();results.push({withdrawal:'Private removal link deleted only the synthetic signup'});}
 // Live check retains one synthetic record for independent native database verification, then cleanup.
 if(!local)await fs.writeFile(path.join(root,'.local/live-check-receipt.json'),JSON.stringify({testEmail,managementLink}));
 assert.deepEqual(errors,[],'Browser JavaScript exceptions');
 const report={target:local?'Local preview':'Published site',results,checks:['Privacy dialog and Escape','Example slide switching','FAQ expansion','Native invalid-email validation','Consent required','Actual browser form submission','Duplicate protection','No JavaScript exceptions'],liveRecordPendingIndependentVerification:!local};
 await fs.writeFile(path.join(directory,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{ws?.close();chrome.kill();await new Promise(r=>setTimeout(r,800));if(path.resolve(profile)===path.join(root,'.local','browser-profile'))await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:250}).catch(()=>{});}

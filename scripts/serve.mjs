import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {openDatabase} from './local-db.mjs';
import {ownerPage,csv,adminCSS} from './admin.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startServer({port=4173,dbPath=path.join(root,'.local/waitlist.sqlite')}={}){
 const worker=(await import(pathToFileURL(path.join(root,'worker/index.js')).href+'?v='+Date.now())).default;
 const DB=openDatabase(dbPath);
 const secretPath=path.join(root,'.local/rate-secret');await fs.mkdir(path.dirname(secretPath),{recursive:true});
 let secret;try{secret=await fs.readFile(secretPath,'utf8');}catch{secret=randomBytes(32).toString('hex');await fs.writeFile(secretPath,secret,{mode:0o600,flag:'wx'});}
 const server=http.createServer(async(req,res)=>{
  try{
   const origin='http://127.0.0.1:'+server.address().port;
   if(req.headers.host!=='127.0.0.1:'+server.address().port){res.writeHead(403);res.end('Local preview host not allowed');return;}
   const localPath=new URL(req.url,origin).pathname;
   if(localPath.startsWith('/local-admin')){
    if(req.method!=='GET'||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end('Local owner view only');return;}
    const responseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Robots-Tag':'noindex, nofollow'};
    if(localPath==='/local-admin/styles.css'){res.writeHead(200,{...responseHeaders,'Content-Type':'text/css'});res.end(adminCSS);return;}
    if(!['/local-admin','/local-admin/export.csv'].includes(localPath)){res.writeHead(404);res.end('Not found');return;}
    const rows=DB.sqlite.prepare('SELECT email,created_at,platform,challenge,utm_source,utm_medium,utm_campaign,consent_version FROM waitlist ORDER BY created_at DESC').all();
    if(localPath.endsWith('.csv')){res.writeHead(200,{...responseHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="pitchmade-waitlist.csv"'});res.end(csv(rows));return;}
    res.writeHead(200,{...responseHeaders,'Content-Type':'text/html; charset=utf-8'});res.end(ownerPage(rows));return;
   }
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers)){if(v&&!k.toLowerCase().startsWith('oai-')&&k.toLowerCase()!=='cf-connecting-ip')headers.set(k,Array.isArray(v)?v.join(','):v);}
   headers.set('CF-Connecting-IP',req.socket.remoteAddress||'local');
   const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
   const response=await worker.fetch(request,{DB,RATE_LIMIT_SALT:secret});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local preview error');}
 });
 await new Promise((r,j)=>{server.once('error',j);server.listen(port,'127.0.0.1',r);});
 return {server,DB,url:'http://127.0.0.1:'+server.address().port,async close(){await new Promise(r=>server.close(r));DB.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await startServer({port:Number(process.env.PORT||4173)});console.log('Landing page: '+app.url);console.log('Signup list and CSV export: '+app.url+'/local-admin');console.log('Storage: .local/waitlist.sqlite on this computer. Not publicly hosted. Keep this window open while using the page.');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}

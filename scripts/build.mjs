import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.mkdir(path.join(root,'worker'),{recursive:true});await fs.mkdir(path.join(root,'dist/server'),{recursive:true});await fs.mkdir(path.join(root,'dist/.openai'),{recursive:true});
const assets={};const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
for(const name of await fs.readdir(path.join(root,'public'))){assets['/'+name]={body:await fs.readFile(path.join(root,'public',name),'utf8'),type:mime[path.extname(name)]||'text/plain'};}
const source='const ASSETS = '+JSON.stringify(assets)+';\n'+await fs.readFile(path.join(root,'src/handler.mjs'),'utf8');
await fs.writeFile(path.join(root,'worker/index.js'),source);await fs.writeFile(path.join(root,'dist/server/index.js'),source);
await fs.mkdir(path.join(root,'dist/cloudflare'),{recursive:true});
await fs.writeFile(path.join(root,'dist/cloudflare/_worker.js'),source);
await fs.copyFile(path.join(root,'public/index.html'),path.join(root,'dist/cloudflare/index.html'));
await fs.copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));if(typeof module.default?.fetch!=='function')throw Error('Worker has no fetch handler');
console.log('Built and parsed the dependency-free landing page and signup handler.');

import {startServer} from './serve.mjs';
const port=4173;
try{
 const running=await fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(1000)});
 if(running.ok&&(await running.text()).includes('id="waitlist-form"')){
  console.log('Pitchmade is already running.');console.log('Landing page: http://127.0.0.1:'+port);console.log('Signups: http://127.0.0.1:'+port+'/local-admin');
  console.log('Use those links in your browser. This window can be closed.');
 }else throw Error('Port is occupied by another application');
}catch(error){
 if(error.message==='Port is occupied by another application')throw error;
 const app=await startServer({port});console.log('Landing page: '+app.url);console.log('Signups and CSV export: '+app.url+'/local-admin');console.log('Keep this window open while using Pitchmade. Press Ctrl+C to stop.');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}

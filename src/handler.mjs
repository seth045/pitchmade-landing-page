// Shared server handler. ASSETS is embedded by the build; the DB binding stays server-side.
const encoder=new TextEncoder();
const security={
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
function reply(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))),n=>n.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
function validRequest(req){const origin=req.headers.get('Origin');if(origin!==new URL(req.url).origin)return false;const cookie=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pm_csrf='))?.slice(8);const token=req.headers.get('X-Waitlist-Token');return /^[a-f0-9]{64}$/.test(token||'')&&equal(cookie,token);}
async function readBody(req){
  if(!(req.headers.get('Content-Type')||'').startsWith('application/json'))throw Object.assign(Error('Please use the signup form.'),{status:415});
  if(Number(req.headers.get('Content-Length')||0)>4096)throw Object.assign(Error('That submission is too long.'),{status:413});
  const reader=req.body?.getReader();if(!reader)throw Object.assign(Error('The form was empty.'),{status:400});
  const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Object.assign(Error('That submission is too long.'),{status:413});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{throw Object.assign(Error('Please check the form and try again.'),{status:400});}
}
function clean(value,max){return typeof value==='string'?value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').slice(0,max):'';}
function isEmail(value){if(value.length>254||value.length<3||/[^\x21-\x7E]/.test(value))return false;const parts=value.split('@');if(parts.length!==2||parts[0].length>64||!parts[0]||parts[0].startsWith('.')||parts[0].endsWith('.')||parts[0].includes('..'))return false;if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(parts[0]))return false;const labels=parts[1].split('.');return labels.length>=2&&labels.every(l=>l.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(l))&&labels.at(-1).length>=2;}
async function allowAttempt(req,env,kind){
  const now=Math.floor(Date.now()/1000);const window=Math.floor(now/3600);const ip=req.headers.get('CF-Connecting-IP')||'local';
  const bucket=kind+':'+await hash(env.RATE_LIMIT_SALT+':'+ip+':'+window);
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
  const result=await env.DB.prepare('INSERT INTO rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(bucket,now+7200).first();
  return Number(result?.attempts)<=12;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);const pathname=url.pathname;
    try{
      if(pathname==='/api/session'&&request.method==='GET'){
        const token=randomToken();return reply({token},200,{'Set-Cookie':'pm_csrf='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200'+(url.protocol==='https:'?'; Secure':'')});
      }
      if(pathname==='/api/waitlist'||pathname==='/api/withdraw'){
        if(request.method!=='POST')return reply({error:'Method not allowed.'},405,{'Allow':'POST'});
        if(!validRequest(request))return reply({error:'Please reload the page and try again.'},403);
        if(!env.DB||!env.RATE_LIMIT_SALT)return reply({error:'Signups are temporarily unavailable. Please try again shortly.'},503);
        const body=await readBody(request);
        if(!(await allowAttempt(request,env,pathname)))return reply({error:'Too many attempts. Please try again in an hour.'},429,{'Retry-After':'3600'});
        if(pathname==='/api/withdraw'){
          if(!/^[a-f0-9]{64}$/.test(body.managementToken||''))return reply({error:'This private link is incomplete.'},400);
          await env.DB.prepare('DELETE FROM waitlist WHERE management_hash = ?').bind(await hash(body.managementToken)).run();
          return reply({ok:true});
        }
        if(body.website)return reply({error:'We couldn’t accept this signup. Please reload and try again.'},400);
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        if(!isEmail(email))return reply({error:'Please enter a valid email address.'},400);
        if(body.consent!==true)return reply({error:'Please confirm that we may email you about Pitchmade.'},400);
        if(typeof body.challenge==='string'&&body.challenge.length>500)return reply({error:'Please keep your feedback under 500 characters.'},400);
        const platform=clean(body.platform,60);if(!['','YouTube','TikTok','Instagram','UGC / content for brands','Other'].includes(platform))return reply({error:'Please choose one of the listed platforms.'},400);
        const managementToken=randomToken();
        const result=await env.DB.prepare('INSERT INTO waitlist (id, email, created_at, platform, challenge, utm_source, utm_medium, utm_campaign, consent_version, management_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
          .bind(crypto.randomUUID(),email,new Date().toISOString(),platform,clean(body.challenge,500),clean(body.utm_source,100),clean(body.utm_medium,100),clean(body.utm_campaign,100),'waitlist-v1-2026-11-05',await hash(managementToken)).run();
        if(result.success===false)throw Error('Write was not confirmed');
        return reply({ok:true,...(Number(result.meta?.changes)===1?{managementToken}:{})});
      }
      if(pathname.startsWith('/api/'))return reply({error:'Not found.'},404);
      if(request.method!=='GET'&&request.method!=='HEAD')return reply({error:'Method not allowed.'},405,{'Allow':'GET, HEAD'});
      const asset=ASSETS[pathname==='/'?'/index.html':pathname==='/manage'?'/manage.html':pathname];
      if(!asset)return new Response('Page not found. Return to Pitchmade at /',{status:404,headers:{...security,'Content-Type':'text/plain; charset=utf-8'}});
      return new Response(request.method==='HEAD'?null:asset.body,{headers:{...security,'Content-Type':asset.type,'Cache-Control':pathname.startsWith('/manage')?'no-store':asset.type.startsWith('text/html')?'no-cache':'public, max-age=3600',...(pathname.startsWith('/manage')?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
    }catch(err){
      if(err.status)return reply({error:err.message},err.status);
      console.error('Waitlist request failed: storage or server unavailable');
      return reply({error:'We couldn’t confirm your signup. Please try again shortly.'},503);
    }
  }
};

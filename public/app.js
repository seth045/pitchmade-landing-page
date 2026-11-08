(() => {
  const form=document.getElementById('waitlist-form');
  const error=document.getElementById('form-error');
  const button=document.getElementById('join-button');
  const email=document.getElementById('email');
  const privacy=document.getElementById('privacy-dialog');
  function openPrivacy(e){e?.preventDefault();if(privacy&&!privacy.open)privacy.showModal();}
  document.querySelectorAll('a[href="#privacy"],#privacy-open').forEach(el=>el.addEventListener('click',openPrivacy));
  document.getElementById('privacy-close')?.addEventListener('click',()=>privacy.close());
  privacy?.addEventListener('click',e=>{if(e.target===privacy){const r=privacy.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)privacy.close();}});
  document.querySelectorAll('[data-slide]').forEach(el=>el.addEventListener('click',()=>{document.querySelectorAll('[data-slide]').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-pressed',String(b===el));});['concept','value'].forEach(s=>document.getElementById('deck-'+s).hidden=s!==el.dataset.slide);document.querySelector('.preview-count').textContent=el.dataset.slide==='concept'?'01 / 02':'02 / 02';}));
  email?.addEventListener('input',()=>email.removeAttribute('aria-invalid'));
  async function jsonFetch(url,options={}){const response=await fetch(url,{...options,credentials:'same-origin',signal:AbortSignal.timeout(20000)});let data;try{data=await response.json();}catch{throw new Error('We couldn’t reach the signup service. Please try again.');}if(!response.ok)throw new Error(data.error||'We couldn’t save your signup. Please try again.');return data;}
  async function token(){return(await jsonFetch('/api/session')).token;}
  form?.addEventListener('submit',async e=>{
    e.preventDefault();if(button.disabled)return;if(!form.reportValidity())return;
    error.textContent='';button.disabled=true;button.textContent='Saving your place…';document.getElementById('form-progress').textContent='Saving your signup';
    const fields=new FormData(form);const params=new URLSearchParams(location.search);
    try{
      const result=await jsonFetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json','X-Waitlist-Token':await token()},body:JSON.stringify({email:fields.get('email'),consent:fields.get('consent')==='on',website:fields.get('website'),platform:fields.get('platform'),challenge:fields.get('challenge'),utm_source:params.get('utm_source')||'',utm_medium:params.get('utm_medium')||'',utm_campaign:params.get('utm_campaign')||''})});
      if(!result.ok)throw new Error('We couldn’t confirm your signup. Please try again.');
      form.hidden=true;document.querySelector('.form-title').hidden=true;const success=document.getElementById('signup-success');success.hidden=false;
      if(result.managementToken){const link=document.getElementById('manage-link');link.href='/manage#'+result.managementToken;link.hidden=false;}else{document.getElementById('existing-note').hidden=false;}
      document.getElementById('form-progress').textContent='Signup saved';success.focus();
    }catch(err){error.textContent=err.name==='TimeoutError'||err.name==='TypeError'?'The connection didn’t complete. Please try again; if it was saved, retrying won’t add you twice.':err.message;document.getElementById('form-progress').textContent='Signup not confirmed';}
    finally{button.disabled=false;button.innerHTML='Join the waitlist <span aria-hidden="true">→</span>';}
  });
  const removeButton=document.getElementById('remove-signup');
  removeButton?.addEventListener('click',async()=>{
    const message=document.getElementById('manage-message');const managementToken=location.hash.slice(1);
    if(!/^[a-f0-9]{64}$/.test(managementToken)){message.textContent='This link is incomplete. Please use the full private link from your signup confirmation.';return;}
    removeButton.disabled=true;message.textContent='Removing your signup…';
    try{await jsonFetch('/api/withdraw',{method:'POST',headers:{'Content-Type':'application/json','X-Waitlist-Token':await token()},body:JSON.stringify({managementToken})});message.textContent='Your signup and feedback have been removed. You’re welcome back anytime.';removeButton.hidden=true;history.replaceState(null,'','/manage');}catch(err){message.textContent=err.message;removeButton.disabled=false;}
  });
})();

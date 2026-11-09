(function(){
 'use strict';
 const form=document.getElementById('inquiry-form');if(!form)return;
 const $=id=>document.getElementById(id),fields=['name','phone','email','street','city','state','zip','concern','description'];
 const errors=$('inquiry-errors'),result=$('inquiry-result'),summary=$('inquiry-summary'),feedback=$('inquiry-feedback'),online=$('inquiry-online-status'),send=$('send-inquiry'),prepare=$('prepare-inquiry');
 const endpoint=form.dataset.endpoint||'/api/public/inquiries';
 let prepared=false,busy=false,received=false,enabled=false,token='',widget=null,payloadKey='',submissionId='';
 form.noValidate=true;form.hidden=false;
 for(const key of fields){const input=form.elements.namedItem(key),described=input.getAttribute('aria-describedby')||'';if(!described.split(' ').includes(key+'-error'))input.setAttribute('aria-describedby',(described+' '+key+'-error').trim());}
 function invalidate(){if(busy||received)return;if(prepared){result.hidden=true;summary.value='';feedback.textContent='';prepared=false;}}
 form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
 function validate(){
  const data=Object.fromEntries(fields.map(k=>[k,form.elements.namedItem(k).value.trim()])),issues={};
  for(const k of ['name','street','city','concern'])if(!data[k])issues[k]='Please complete this field.';
  if(!data.phone&&!data.email)issues.phone=issues.email='Enter a phone number or email address.';
  if(data.phone&&(!/^[+\d\s().-]+$/.test(data.phone)||!/^(?:1)?\d{10}$/.test(data.phone.replace(/\D/g,''))))issues.phone='Enter a 10-digit phone number, with an optional +1.';
  if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))issues.email='Enter a valid email address.';
  if(!/^[a-z]{2}$/i.test(data.state))issues.state='Use the two-letter state abbreviation.';
  if(!/^\d{5}(?:-\d{4})?$/.test(data.zip))issues.zip='Enter a five-digit ZIP code (or ZIP+4).';
  if(data.description.length<10||data.description.length>1500)issues.description='Describe the problem in 10–1,500 characters.';
  for(const k of fields){const input=form.elements.namedItem(k);if(input.maxLength>0&&data[k].length>input.maxLength)issues[k]='Please shorten this field.';input.setAttribute('aria-invalid',issues[k]?'true':'false');$(k+'-error').textContent=issues[k]||'';}
  if(Object.keys(issues).length){errors.hidden=false;errors.textContent='Please check the highlighted fields. Nothing has been sent.';form.elements.namedItem(fields.find(k=>issues[k])).focus();return null;}
  errors.hidden=true;return data;
 }
 function message(data){return ['Wildlife Ops service inquiry','','Name: '+data.name,'Phone: '+(data.phone||'Not provided'),'Email: '+(data.email||'Not provided'),'Service location: '+data.street+', '+data.city+', '+data.state+' '+data.zip,'Wildlife concern: '+data.concern,'','Problem description:',data.description].join('\n');}
 prepare.addEventListener('click',()=>{if(busy||received)return;invalidate();const data=validate();if(!data)return;summary.value=message(data);result.hidden=false;prepared=true;feedback.textContent='Nothing has been sent. Copy this message, open a text or email, paste it, and send it to Wildlife Ops.';summary.focus();});
 $('copy-inquiry').addEventListener('click',async()=>{if(!prepared)return;try{if(!navigator.clipboard||!window.isSecureContext)throw Error();await navigator.clipboard.writeText(summary.value);feedback.textContent='Copied. Paste the message into a text or email and send it. Nothing has been sent by this page.';}catch{summary.focus();summary.select();feedback.textContent='Automatic copying is unavailable. Select and copy the message, then paste it into a text or email. Nothing has been sent.';}});
 function busyState(value){busy=value;form.setAttribute('aria-busy',String(value));$('inquiry-fields').disabled=value||received;send.disabled=value||received||!enabled||!token;prepare.disabled=value||received;send.textContent=value?'Sending…':received?'Inquiry received':'Send inquiry';}
 function resetChallenge(){token='';if(widget!==null&&window.turnstile)window.turnstile.reset(widget);}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||received)return;invalidate();const data=validate();if(!data)return;
  function problem(text){errors.hidden=false;errors.textContent=text;errors.focus();}
  if(!enabled){problem('Online submission is unavailable. You can prepare a text/email message instead.');return;}
  if(!form.elements.namedItem('consent').checked){problem('Please agree to inquiry review so we can receive and respond to your inquiry.');$('inquiry-consent').focus();return;}
  if(!token){problem('Please complete the security check again.');resetChallenge();return;}
  const key=JSON.stringify(data);if(key!==payloadKey){payloadKey=key;submissionId=crypto.randomUUID();}
  const b={...data,id:submissionId,token,consent:true,website:form.elements.namedItem('website').value};busyState(true);online.textContent='Sending your inquiry…';
  try{
   const response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),signal:AbortSignal.timeout(15000)});const receipt=await response.json();
   if(!response.ok)throw Error(receipt.error||'Could not confirm receipt. Retry unchanged or call us.');
   if(receipt.received!==true||!/^WOI-[A-F0-9]{12}$/.test(receipt.reference))throw Error('Could not confirm receipt. Retry unchanged or call us.');
   received=true;errors.hidden=true;result.hidden=true;online.textContent='Your inquiry was received. Reference: '+receipt.reference+'. Wildlife Ops will review it and contact you. A service visit has not been booked.';online.setAttribute('tabindex','-1');online.focus();
  }catch(e){problem(e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError?'We could not confirm receipt. Your entries are still here. Retry with the same details to check safely, or call 330-565-9322.':e.message);online.textContent='Your entries have been kept. You can retry or prepare a text/email message.';}
  finally{resetChallenge();busyState(false);}
 });
 function unavailable(){enabled=false;send.disabled=true;online.textContent='Online submission is temporarily unavailable. Use “Prepare text/email instead,” or call or text 330-565-9322.';}
 fetch(endpoint,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{if(!response.ok)throw Error();const config=await response.json();if(config.enabled!==true||!config.sitekey){unavailable();return;}enabled=true;const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.addEventListener('error',unavailable);script.addEventListener('load',()=>{try{widget=window.turnstile.render($('inquiry-challenge'),{sitekey:config.sitekey,action:'inquiry',callback:value=>{token=value;busyState(busy);},'expired-callback':()=>{token='';busyState(busy);online.textContent='Security check expired. Please complete it again.';},'error-callback':()=>{token='';busyState(busy);online.textContent='Security check unavailable. Please retry or use text/email.';return true;}});online.textContent='Complete the security check, then send your inquiry.';}catch{unavailable();}});document.head.append(script);}).catch(unavailable);
})();

import {scheduledMessage,updateScheduledMessage} from './scheduled-message.js?v=1';
import {setupSourceData} from './source-data.js?v=6';
import {setupCalendar} from './calendar.js?v=4';
import {seed,act,advance,slots,statusLabel,nextAction,fmtFull,fmtDate,fmtTime,VERSION,knowledge,money,balance,paid,canTakePayment,cardEnding,PAY_METHODS,ledger} from './engine.js?v=6';

import {extendPatients} from './demo-patients.js?v=9';

const KEY='cedar-register-v1';
function initialState(){
 const s=seed();
 act(s,'jordan','slots');act(s,'jordan','book',slots(s,s.cases[1])[1].id);
 act(s,'alex','pause');
 return extendPatients(s);
}
let state,query='',filter='all',tab='overview',chosen=null,pending=null;
try { const saved=JSON.parse(localStorage.getItem(KEY)); state=saved?.version===VERSION&&saved.cases?.length>=3?saved:initialState(); } catch { state=initialState(); }
state=extendPatients(state);
const workspace=document.querySelector('#patient-workspace');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeCases=()=>state.cases.filter(c=>c.sourceStatus!=='completed'&&c.contact&&!['declined','closed','stopped'].includes(c.status));
function attentionFor(c){
 if(c.attention)return c.attention;
 if(c.note.includes('does not include the patient-specific rationale')&&!c.consult)return {owner:c.note.match(/Dr\.\s+[^·:]+/)?.[0].trim()||'Dentist',reason:'Needs clinical clarification',title:'Clarify the recommendation',detail:'The chart is missing the patient-specific reason. Review it before Clara explains why treatment was recommended.'};
 return null;
}
const groupOf=c=>c.appointment?'booked':attentionFor(c)?'attention':'active';
const groupLabels={attention:'Needs attention',active:'In progress',booked:'Booked'};
const followUp=c=>groupOf(c)==='attention'?`${attentionFor(c).owner} · ${attentionFor(c).title.toLowerCase()}`:nextAction(c);
function situation(c){
 if(c.appointment){
  const end=c.appointment.start+(c.appointment.duration||60)*60000;
  return end<state.now?'Past appointment · confirm outcome':`${c.consult?'Discussion':'Booked'} · ${fmtFull(c.appointment.start)}, ${fmtTime(c.appointment.start)}`;
 }
 if(groupOf(c)==='attention')return attentionFor(c).reason;
 if(c.status==='paused')return c.wakeAt?`Paused until ${fmtDate(c.wakeAt)}`:'Follow-up paused';
 if(c.stage==='cancelled')return 'Needs a new appointment';
 if(c.stage==='slots')return 'Choosing a time';
 if(c.stage==='explained')return 'Questions answered · awaiting reply';
 return c.attempts>1?'No reply to follow-up':'Awaiting reply';
}
function rowStatus(c){
 const attention=groupOf(c)==='attention';
 const tone=attention?'attention':c.status==='paused'?'paused':c.appointment?'booked':'active';
 return `<span class="patient-status-line ${tone}"><i aria-hidden="true"></i><span>${escape(situation(c))}</span>${attention?`<span class="attention-owner">${escape(attentionFor(c).owner)}</span>`:''}${c.appointment&&c.billing&&!balance(c)?'<span class="paid-tag">Paid</span>':''}</span>`;
}
const current=()=>activeCases().find(c=>c.id===state.selected)||activeCases()[0];
const button=(text,action,extra='')=>`<button class="control" data-action="${action}" ${extra}>${text}</button>`;
const status=c=>`<span class="state ${groupOf(c)==='attention'?'wait':''}">${groupLabels[groupOf(c)]}</span>`;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{notify('Storage unavailable. Refresh will reset this demo.');}}
const notice=document.createElement('div');notice.className='notice';notice.setAttribute('role','status');document.body.append(notice);
function notify(text){if(!text)return;notice.textContent=text;notice.classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>notice.classList.remove('visible'),3500);}
function render(){
 if(!workspace)return;
 if(!activeCases().some(c=>c.id===state.selected))state.selected=activeCases()[0]?.id;
 workspace.innerHTML=`<div class="register-layout"><section class="grouped-register" aria-label="Patients grouped by status"><div class="register-controls"><span>${activeCases().length} patients</span><div><input id="patient-search" aria-label="Search patients" placeholder="Search patients" value="${escape(query)}"><select id="patient-filter" aria-label="Filter status">${[['all','All statuses'],['attention','Needs attention'],['active','In progress'],['booked','Booked']].map(([v,t])=>`<option value="${v}" ${v===filter?'selected':''}>${t}</option>`).join('')}</select></div></div><div id="patient-rows"></div></section><aside id="selected-patient" aria-label="Selected patient"></aside></div>`;
 renderRows();renderCase();save();
}
function renderRows(){
 const list=activeCases().filter(c=>`${c.name} ${c.treatment}`.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||groupOf(c)===filter));
 const groups=Object.entries(groupLabels);
 document.querySelector('#patient-rows').innerHTML=list.length?groups.map(([key,label])=>{
  const members=list.filter(c=>groupOf(c)===key);if(!members.length)return '';
  return `<section class="status-group"><h2><span class="group-dot ${key}"></span>${label}${key==='booked'?'<button type="button" class="open-calendar-link" data-open-calendar>Open calendar</button>':''}<span class="group-count">${members.length}</span></h2><div class="group-rows">${members.map(c=>`<button class="group-row ${c.id===state.selected?'selected':''}" data-action="select" data-value="${c.id}" aria-pressed="${c.id===state.selected}"><span class="row-person"><strong>${c.name}</strong><small>${c.treatment}</small></span><span class="row-progress">${rowStatus(c)}</span><span class="row-chevron" aria-hidden="true">›</span></button>`).join('')}</div></section>`;
 }).join(''):`<div class="empty-register">No patients match this search. ${button('Clear filters','clear')}</div>`;

}
function overview(c){const noteParts=c.note.match(/^([^:]+):\s*([\s\S]+)$/);const note=noteParts?noteParts[2]:c.note;const provenance=noteParts?`${noteParts[1]} · `:'';return `<div class="record-body"><section class="chart-excerpt"><h3>From the chart</h3><p>${escape(note)}</p><div class="source-foot">${escape(provenance)}Patient chart · synced at demo start</div></section><section class="chart-status"><dl class="facts source-facts"><div><dt>Treatment history</dt><dd>${c.sourceStatus==='completed'?'Completion confirmed':'No completion recorded'}</dd></div><div><dt>Scheduling</dt><dd>${c.appointment?`${c.appointment.kind} · ${fmtFull(c.appointment.start)}, ${fmtTime(c.appointment.start)}`:'No appointment booked'}</dd></div><div><dt>Text messages</dt><dd>${c.contact?'Allowed':'Stopped by patient'}</dd></div></dl></section>${billingPanel(c)}<section><h3>Recent activity</h3><ol class="mini-events">${c.events.slice(-4).map(e=>`<li><time>${fmtDate(e.at)}<br>${fmtTime(e.at)}</time><div><strong>${e.title}</strong><p>${escape(e.detail)}</p></div></li>`).join('')}</ol><div class="next">Next: ${followUp(c)}.</div></section></div>`;}
function billingPanel(c){
 const b=c.billing;if(!b)return '';
 const due=balance(c),last=b.payments[b.payments.length-1];
 const action=canTakePayment(c)?`<button class="control pay-button" data-action="pay" data-primary="true">Take payment · ${money(due)}</button>`:last&&!due?`<p class="billing-paid"><span class="paid-tag">Paid</span>${money(last.amount)} · ${fmtDate(last.at)}, ${fmtTime(last.at)} · ${escape(last.method)}</p>`:`<p class="billing-note">${c.appointment?'Payment is taken for treatment visits.':'Payment is taken once a treatment visit is booked.'}</p>`;
 return `<section class="billing-panel"><h3>Insurance &amp; billing</h3><dl class="facts source-facts"><div><dt>Plan</dt><dd>${escape(b.plan)}</dd></div><div><dt>Insurance estimate</dt><dd>${b.insurance?money(b.insurance):'None'}</dd></div><div><dt>Patient share</dt><dd>${money(b.share)}${paid(c)?` · ${due?`${money(due)} due`:'paid'}`:''}</dd></div></dl>${action}</section>`;
}
function replies(c){
 if(c.attention)return '<div class="conversation-ended">Front desk review needed before scheduling.</div>';
 if(!c.contact||['completed','closed','declined'].includes(c.status))return `<div class="conversation-ended">${c.sourceStatus==='completed'?'Treatment complete. Future follow-up stopped.':!c.contact?'Messages stopped. Existing appointments remain booked.':c.status==='declined'?'Patient declined. The recommendation remains in the clinical record.':'Outreach stopped after three unanswered messages.'}</div>`;
 const reply=(text,type)=>button(text,'reply',`data-value="${type}"`);
 let controls='';
 if(c.stage==='slots') controls=`<div class="slot-caption">${c.consult?'Discussion · 30 minutes · Dr. Shah':`Treatment · ${c.duration||60} minutes · Dr. Lee`}</div><div class="time-options">${slots(state,c).map(s=>button(`${fmtFull(s.start)} · ${fmtTime(s.start)}`,'slot',`data-value="${s.id}" aria-pressed="${s.id===chosen}"`)).join('')}</div>${button(c.appointment?'Confirm new time':'Confirm appointment','book',`data-primary="true" ${chosen?'':'disabled'}`)}`;
 else if(c.stage==='booked') controls=reply('Change appointment','slots')+button('Cancel appointment','cancel');
 else if(c.stage==='paused') controls=reply('I’m ready now','slots',true);
 else if(c.stage==='cancelled') controls=reply('Find another time','slots',true)+reply('Contact me next week','pause');
 else if(c.stage==='explained') controls=(c.id==='alex'?'':reply('Find a time','slots',true))+reply('Discuss with the dentist','consult',c.id==='alex')+reply('What happens at the visit?','visit');
 else controls=reply('Why was this recommended?','why')+reply('Find a time','slots',true)+reply('Contact me next week','pause');
 return `<div class="response-label">Try a patient response <span>Scripted demo</span></div><div class="response-options">${controls}</div><details class="more-choices"><summary>More choices</summary><div>${!c.appointment?reply('Contact me next week','pause')+reply('I don’t want to proceed','decline'):''}${button('Stop messages','stop')}</div></details>`;
}
function reminderPreview(c){const m=scheduledMessage(state,c);if(!m)return '';return `<div class="scheduled-message ${m.paused?'is-paused':''}" aria-label="Scheduled message"><div class="scheduled-caption">${m.paused?'Paused':'Scheduled'} · ${fmtFull(m.at)}, ${fmtTime(m.at)} · ${m.kind}</div><div class="scheduled-bubble"><p>${escape(m.text)}</p></div><div class="scheduled-actions">${m.paused?'<button data-action="reminder-resume">Resume</button>':'<button data-action="reminder-send">Send now</button><button data-action="reminder-pause">Pause</button>'}</div></div>`;}
function conversation(c){let previousDay='';return `<div class="conversation"><div class="message-history">${c.messages.map(m=>{const date=new Date(m.at);const day=date.toISOString().slice(0,10);const dateLabel=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(date).replace(',','');const separator=day!==previousDay?`<div class="conversation-date"><time datetime="${date.toISOString().slice(0,10)}">${escape(dateLabel)}</time></div>`:'';previousDay=day;return `${separator}<div class="message-turn ${m.who}"><article class="chat-message ${m.who}"><div class="chat-who">${m.who==='patient'?c.name.split(' ')[0]:'Clara · AI assistant'}<span class="message-channel">${m.channel==='email'?'Email':'Text'}</span></div><p>${escape(m.text)}</p>${m.sources.length?`<details class="message-source"><summary>Sources used</summary>${m.sources.map(id=>`<p><strong>${id==='note'?'Patient chart':knowledge.find(k=>k.id===id).title}</strong><br>${escape(id==='note'?c.note:knowledge.find(k=>k.id===id).text)}</p>`).join('')}</details>`:''}</article><time class="message-time" datetime="${date.toISOString()}">${fmtTime(m.at)}</time></div>`;}).join('')}${reminderPreview(c)}</div>${c.appointment?`<div class="booking-summary"><div class="booking-date"><span>${new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(c.appointment.start)}</span><strong>${new Date(c.appointment.start).getUTCDate()}</strong></div><div class="booking-info"><div class="booking-title">${c.appointment.kind==='Discussion'?'Dentist discussion':'Treatment appointment'}<span class="booking-confirmed"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 8 2.5 2.5L12 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${c.sourceStatus==='completed'?'Completed':'Confirmed'}</span></div><div class="booking-time">${new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(c.appointment.start)} · ${fmtTime(c.appointment.start)}</div><div class="booking-provider">${escape(c.appointment.provider)} · ${c.appointment.duration||60} min</div></div>${canTakePayment(c)?`<button class="control booking-pay" data-action="pay">Take payment · ${money(balance(c))}</button>`:c.billing&&!balance(c)&&c.billing.payments.length?`<div class="booking-payment-receipt"><span class="paid-tag">Paid · ${money(paid(c))}</span><small>Receipt ${escape(c.billing.payments.at(-1).receipt)} · Balance ${money(balance(c))}</small></div>`:''}</div>`:''}<div class="response-area">${replies(c)}</div></div>`;}
function renderCase(){const c=current();if(!c){document.querySelector('#selected-patient').innerHTML='';return;}document.querySelector('#selected-patient').innerHTML=`<section class="patient-record active-case"><div class="active-case-heading"><div><h2>${c.name}</h2><small>${c.treatment} · Chart #${c.chartId}</small></div>${status(c)}</div>${groupOf(c)==='attention'?`<div class="attention-context"><span class="attention-owner">${escape(attentionFor(c).owner)}</span><div><strong>${escape(attentionFor(c).title)}</strong><p>${escape(attentionFor(c).detail)}</p></div></div>`:''}<div class="case-nav" role="tablist" aria-label="Patient detail">${[['overview','Patient info'],['conversation','Communication']].map(([id,name])=>`<button role="tab" aria-selected="${tab===id}" data-action="tab" data-value="${id}">${name}</button>`).join('')}</div><div role="tabpanel">${tab==='overview'?overview(c):conversation(c)}</div></section>`;const history=document.querySelector('.message-history');if(history)history.scrollTop=history.scrollHeight;syncMobilePatient();}
const mobilePatientMedia=matchMedia('(max-width:900px)');
const mobilePatient=document.createElement('dialog');
mobilePatient.className='mobile-patient-dialog register-layout';
mobilePatient.setAttribute('aria-label','Patient details');
mobilePatient.innerHTML='<header class="mobile-patient-toolbar"><span>Patient details</span><button type="button" data-action="close-patient" aria-label="Close patient details">✕</button></header><div class="mobile-patient-body"></div>';
document.body.append(mobilePatient);
mobilePatient.addEventListener('close',()=>document.querySelector('.group-row.selected')?.focus({preventScroll:true}));
let patientBackdropDown=false;
function outsidePatient(e){const r=mobilePatient.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
mobilePatient.addEventListener('pointerdown',e=>{patientBackdropDown=outsidePatient(e);});
mobilePatient.addEventListener('pointerup',e=>{if(patientBackdropDown&&outsidePatient(e))mobilePatient.close();patientBackdropDown=false;});
mobilePatientMedia.addEventListener('change',e=>{if(!e.matches&&mobilePatient.open)mobilePatient.close();});
function syncMobilePatient(){
 if(!mobilePatient.open)return;
 const c=current();if(!c){mobilePatient.close();return;}
 mobilePatient.setAttribute('aria-label',`${c.name} — Patient details`);
 mobilePatient.querySelector('.mobile-patient-body').innerHTML=document.querySelector('#selected-patient').innerHTML;
 const history=mobilePatient.querySelector('.message-history');if(history)history.scrollTop=history.scrollHeight;
}
const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','dialog-title');document.body.append(dialog);
function confirm(action){pending=action;if(action==='pay')return confirmPayment();const text={reset:['Restart the demo?','Restore the starting patients, conversations, bookings, payments, and practice clock in this browser. Your Knowledge edits will stay.'],cancel:['Cancel appointment?','Release this appointment and reopen scheduling follow-up.'],stop:['Stop messages?','Stop future outreach. Any existing appointment remains booked.']}[action];dialog.innerHTML=`<h2 id="dialog-title">${text[0]}</h2><p>${text[1]}</p><div>${button('Go back','dismiss')}${button(action==='reset'?'Reset demo':'Confirm','confirm','data-primary="true"')}</div>`;dialog.showModal();}
function confirmPayment(){
 const c=current();if(!canTakePayment(c)){notify('Already paid. No balance due.');return;}
 const b=c.billing,due=balance(c);
 dialog.innerHTML=`<h2 id="dialog-title">Take payment from ${escape(c.name.split(' ')[0])}</h2><p>${money(due)} patient share for ${escape(c.treatment)}. ${b.insurance?`The ${money(b.insurance)} insurance estimate is billed to ${escape(b.plan)} separately.`:'Self-pay: no insurance claim.'}</p><fieldset class="pay-methods"><legend>Payment method</legend><label><input type="radio" name="pay-method" value="card" checked><span>${PAY_METHODS.card}<small>Visa ending ${cardEnding(c)}</small></span></label><label><input type="radio" name="pay-method" value="desk"><span>${PAY_METHODS.desk}<small>Patient pays in person</small></span></label></fieldset><p class="pay-fine">Demo only. No card is charged.</p><div>${button('Go back','dismiss')}${button(`Charge ${money(due)}`,'charge','data-primary="true"')}</div>`;
 dialog.showModal();dialog.querySelector('[data-action="charge"]').focus();
}
function charge(b){
 const method=dialog.querySelector('input[name="pay-method"]:checked')?.value||'card';
 b.disabled=true;b.textContent='Processing…';dialog.querySelector('[data-action="dismiss"]').disabled=true;
 dialog.close();perform('pay',method);
}
function perform(type,value){const result=act(state,state.selected,type,value);chosen=null;render();notify(result.message);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,v=b.dataset.value;
 if(a==='select'){state.selected=v;chosen=null;if(mobilePatientMedia.matches)tab='overview';render();if(mobilePatientMedia.matches){mobilePatient.showModal();syncMobilePatient();mobilePatient.scrollTop=0;}}
 else if(a==='close-patient')mobilePatient.close();
 else if(a==='tab'){tab=v;renderCase();}
 else if(a.startsWith('reminder-')){if(updateScheduledMessage(state,current(),a.slice(9))){render();notify(a==='reminder-send'?'Reminder sent in the demo.':a==='reminder-pause'?'Reminder paused. Appointment unchanged.':'Reminder resumed.');}}
 else if(a==='reply')perform(v);
 else if(a==='slot'){chosen=v;renderCase();(mobilePatient.open?mobilePatient:document).querySelector('[data-action="book"]')?.focus();}
 else if(a==='book')perform('book',chosen);
 else if(a==='advance'){chosen=null;notify(advance(state));render();}
 else if(a==='complete')perform('complete');
 else if(['reset','cancel','stop','pay'].includes(a))confirm(a);
 else if(a==='charge')charge(b);
 else if(a==='dismiss')dialog.close();
 else if(a==='confirm'){dialog.close();if(pending==='reset'){if(mobilePatient.open)mobilePatient.close();state=initialState();query='';filter='all';tab='overview';chosen=null;render();document.querySelector('.demo-reset')?.focus({preventScroll:true});notify('Demo reset. Ready for a new walkthrough.');}else perform(pending);}
 else if(a==='clear'){query='';filter='all';render();}
});
document.addEventListener('input',e=>{if(e.target.id==='patient-search'){query=e.target.value;renderRows();}});
document.addEventListener('change',e=>{if(e.target.id==='patient-filter'){filter=e.target.value;renderRows();}});
render();

// Integrations page: live summary of payments recorded in this demo.
function fillBillingLive(){
 const el=document.querySelector('[data-billing-live]');if(!el)return;
 const all=ledger(state),last=all[0],day=Math.floor(state.now/86400000);
 const today=all.filter(p=>Math.floor(p.at/86400000)===day),total=today.reduce((t,p)=>t+p.amount,0);
 const due=state.cases.filter(c=>c.appointment&&c.sourceStatus!=='completed').reduce((t,c)=>t+balance(c),0);
 el.innerHTML=last?`<p><span class="live-dot" aria-hidden="true"></span>Last payment <strong>${money(last.amount)}</strong> · ${escape(last.name)} · ${fmtDate(last.at)}, ${fmtTime(last.at)}</p><p>Today ${money(total)} collected · ${today.length} ${today.length===1?'payment':'payments'} · ${money(due)} still due on booked visits</p>`:'<p>No payments recorded yet.</p>';
}
fillBillingLive();
function fillLive(){
 const set=(key,html)=>{const el=document.querySelector(`[data-live="${key}"]`);if(el)el.innerHTML=`<p><span class="live-dot" aria-hidden="true"></span>${html}</p>`;};
 const upcoming=state.cases.filter(c=>c.appointment&&c.sourceStatus!=='completed'&&c.appointment.start>=state.now).sort((a,b)=>a.appointment.start-b.appointment.start);
 const next=upcoming[0];
 set('scheduling',next?`<strong>${upcoming.length}</strong> upcoming ${upcoming.length===1?'visit':'visits'} · next ${escape(next.name)}, ${fmtFull(next.appointment.start)} at ${fmtTime(next.appointment.start)}`:'No upcoming visits booked');
 const open=state.cases.filter(c=>c.sourceStatus!=='completed').length;
 set('charts',`<strong>${state.cases.length}</strong> charts synced · ${open} with outstanding care`);
 const done=state.cases.filter(c=>c.sourceStatus==='completed');
 set('history',done.length?`<strong>${done.length}</strong> ${done.length===1?'completion':'completions'} recorded · latest ${escape(done[done.length-1].name)}`:'No completions recorded yet');
}
fillLive();

setupCalendar(()=>state);

setupSourceData(()=>state);

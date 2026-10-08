import {loadKnowledge} from './knowledge-store.js?v=1';
import {composeAnswer} from './knowledge-response.js?v=2';
export const VERSION = 1;
export const DAY = 86400000;
export const START = Date.UTC(2026,9,12,9);
export const knowledge = [
 {id:'crown', title:'Understanding a recommended crown', category:'Treatment understanding', source:'Practice-approved patient guide', updated:'Oct 8, 2026', text:'A crown covers and supports a tooth. A dentist may recommend one when the remaining tooth needs protection. The patient’s own clinical record supplies the reason for their recommendation; this guide does not establish a diagnosis.'},
 {id:'visit', title:'What happens at the visit', category:'Patient experience', source:'Cedar Dental care team', updated:'Oct 8, 2026', text:'The dental team reviews the planned treatment and answers questions before beginning. The booked visit follows the existing treatment plan. Patients can ask to discuss the recommendation before deciding to proceed.'},
 {id:'schedule', title:'Finding the right appointment', category:'Scheduling', source:'Practice scheduling configuration', updated:'Oct 9, 2026', text:'Treatment visits use the length in each patient’s plan (30–90 minutes) with Dr. Lee. A discussion with Dr. Shah is 30 minutes. Check current availability before confirming. A discussion does not complete the treatment plan.'}
];
export const fmtDate = t => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(t);
export const fmtFull = t => new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(t);
export const fmtTime = t => new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(t);
// Insurance & billing (fictional plans and fees). Patient share = fee − insurance estimate.
const BILLING={
 maya:[1250,750,'Harbor Mutual PPO'],jordan:[1250,750,'Harbor Mutual PPO'],alex:[1250,625,'Northline Dental'],
 priya:[210,168,'Harbor Mutual PPO'],daniel:[880,616,'Bayside Benefits'],olivia:[1100,880,'Northline Dental'],
 marcus:[320,256,'Bayside Benefits'],sofia:[1250,750,'Harbor Mutual PPO'],ethan:[210,0,'Self-pay'],
 nora:[180,144,'Northline Dental'],grace:[95,76,'Bayside Benefits'],ben:[450,0,'Self-pay'],'ella-cost':[1250,700,'Bayside Benefits']
};
export const PAY_METHODS={card:'Card on file',desk:'Card reader at front desk'};
/** "Filling · tooth 14" → "filling for tooth 14", as it reads in a text. */
export const spoken=t=>{const [what,where]=String(t).split(' · ');return (where?`${what} for ${/^tooth/.test(where)?'':'the '}${where}`:what).toLowerCase();};
export const money=n=>`$${Number(n).toLocaleString('en-US')}`;
export function attachBilling(c){
 if(c.billing)return c;
 const [fee,insurance,plan]=BILLING[c.id]||[1250,750,'Harbor Mutual PPO'];
 c.billing={plan,fee,insurance,share:fee-insurance,payments:[]};
 return c;
}
export const cardEnding=c=>String(4200+(c.chartId||0)%100).padStart(4,'0');
export const paid=c=>(c.billing?.payments||[]).reduce((t,p)=>t+p.amount,0);
export const balance=c=>c.billing?Math.max(0,c.billing.share-paid(c)):0;
export const canTakePayment=c=>!!(c.billing&&c.appointment&&c.appointment.kind==='Treatment'&&balance(c)>0);
/** After a treatment visit is booked, Clara texts the estimated share once and lets the patient pay or choose to pay at the visit. */
export function requestPayment(s,c){
 if(!c.billing||c.billing.requestedAt||!c.contact||c.sourceStatus==='completed'||!c.appointment||c.appointment.kind!=='Treatment'||c.appointment.start<s.now||balance(c)<=0)return false;
 const b=c.billing;c.billing.requestedAt=s.now;
 say(s,c,`Your estimated share for this visit is ${money(balance(c))}${b.insurance?` (${money(b.fee)} fee, less the ${money(b.insurance)} ${b.plan} is expected to cover)`:' (self-pay)'}. You can pay now with the Visa on file ending ${cardEnding(c)}, or pay when you check in.`);
 event(s,c,'Payment requested',`Estimated share of ${money(balance(c))} sent by text. Patient chooses to pay now or at the visit.`);
 return true;
}
export function ledger(s){return s.cases.flatMap(c=>(c.billing?.payments||[]).map(p=>({...p,caseId:c.id,name:c.name,treatment:c.treatment}))).sort((a,b)=>(b.at-a.at)||((b.seq||0)-(a.seq||0)));}
export function event(s,c,title,detail){ c.events.push({id:`${c.id}-${c.events.length}`,at:s.now,title,detail}); }
function say(s,c,text,who='agent',sources=[]){c.messages.push({id:`${c.id}-m${c.messages.length}`,at:s.now,who,text,sources});}
function patient(s,c,text){say(s,c,text,'patient');}
const base = (id,name,initials,color,barrier,note) => ({id,name,initials,color,barrier,note,treatment:'Crown · tooth 30',sourceStatus:'active',status:'eligible',stage:'outreach',contact:true,appointment:null,wakeAt:null,attempts:0,messages:[],events:[],sources:[],consult:false});
const CHART_IDS={maya:1042,jordan:1087,alex:1103};
export function seed(){const s={version:VERSION,now:START,selected:'maya',view:'admin',page:'patients',tab:'conversation',cases:[
 base('maya','Maya Chen','MC','lilac','Treatment understanding','Dr. Lee · Oct 9: Tooth 30 has a recorded crack. A crown was recommended to protect and support the remaining tooth.'),
 base('jordan','Jordan Ellis','JE','blue','Scheduling','Dr. Lee · Oct 9: Tooth 30 has a recorded crack. A crown was recommended to protect and support the remaining tooth. Patient asked for help finding a time.'),
 base('alex','Alex Morgan','AM','peach','Treatment understanding','Dr. Lee · Oct 9: Crown recommended for tooth 30. The synced note does not include the patient-specific rationale.')
]};s.cases.forEach(c=>{c.chartId=CHART_IDS[c.id];attachBilling(c);});processDue(s);return s;}
export function processDue(s){for(const c of s.cases){
 if(!c.contact||c.sourceStatus==='completed'||c.appointment||['declined','closed'].includes(c.status))continue;
 if(c.status==='eligible'){say(s,c,c.outreach||`Hi ${c.name.split(' ')[0]}, I’m Clara, Cedar Dental’s AI assistant. You have a crown recommendation from Dr. Lee that hasn’t been scheduled. I can help you understand the recommendation or find a time. What would be helpful?`);c.status='waiting';c.attempts=1;c.wakeAt=s.now+3*DAY;event(s,c,'Follow-up started','Current plan and contact preferences checked. Initial message sent automatically.');}
 else if(c.wakeAt&&s.now>=c.wakeAt){
 if(c.status==='paused'){c.status='engaged';c.stage='slots';c.wakeAt=null;say(s,c,`Hi ${c.name.split(' ')[0]}, you asked me to reconnect today. I’ve checked the current plan and availability. Would you like to find a time${c.consult?' to discuss the recommendation':''}?`);event(s,c,'Resumed as requested','Remembered the requested date and checked for an existing booking before contacting the patient.');}
 else if(c.status==='waiting'){if(c.attempts<3){c.attempts++;say(s,c,c.attempts===3?'One last check-in about your recommended care. If now isn’t a good time, I can pause these messages, or you can contact the practice whenever you’re ready.':'Checking back on your recommended care. I can help explain the recorded recommendation, find a time, or pause these messages.');c.wakeAt=s.now+(c.attempts===2?4:3)*DAY;event(s,c,'Follow-up sent',`Attempt ${c.attempts} of 3. No booking or contact hold found.`);}else{c.status='closed';c.wakeAt=null;event(s,c,'Outreach concluded','No reply after three messages. Treatment remains outstanding; no further outreach is scheduled.');}}
 }
}}
export function slots(s,c){const out=[];let d=s.now+DAY;while(out.length<3){const date=new Date(d);const day=date.getUTCDay();if(day!==0&&day!==6){const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),out.length===1?14:10);const id=`${start}-${c.consult?'shah':'lee'}`;if(!s.cases.some(x=>x.appointment?.id===id)){out.push({id,start,duration:c.consult?30:(c.duration||60),provider:c.consult?'Dr. Shah':'Dr. Lee',kind:c.consult?'Discussion':'Treatment'});}}d+=DAY;}return out;}
export function nextAction(c){if(!c.contact)return 'Contact stopped';if(c.sourceStatus==='completed')return 'No further follow-up';if(c.appointment)return `${c.appointment.kind} · ${fmtFull(c.appointment.start)}`;if(c.wakeAt)return `${c.status==='paused'?'Reconnect':'Follow up'} · ${fmtDate(c.wakeAt)}`;if(c.status==='declined')return 'Patient chose not to proceed';if(c.status==='closed')return 'Outreach concluded';return 'Waiting for patient choice';}
export const statusLabel = c => !c.contact?'Contact stopped':({eligible:'Ready',waiting:'Awaiting reply',engaged:'In conversation',paused:'Paused',booked:c.consult?'Discussion booked':'Treatment booked',completed:'Completed',declined:'Declined',closed:'No response'}[c.status]||c.status);
export function canReply(c){return c.contact&&c.sourceStatus!=='completed'&&!['declined','closed'].includes(c.status);}
export function act(s,id,type,payload,context={}){const c=s.cases.find(x=>x.id===id);if(!c)return {ok:false,message:'Patient not found.'};
 if(type==='complete'){
  if(!c.appointment||c.appointment.kind!=='Treatment')return {ok:false,message:'A treatment appointment is required.'};
  s.now=Math.max(s.now,c.appointment.start+c.appointment.duration*60000);c.sourceStatus='completed';c.status='completed';c.stage='done';c.wakeAt=null;
  event(s,c,'Treatment confirmed complete','Treatment history confirms the treatment was completed. Pending follow-up removed.');return {ok:true,message:'Practice record updated. Treatment complete.'};
 }
 if(type==='resolve'){
  const billingReview=!!c.attention,clinicalReview=c.note.includes('does not include the patient-specific rationale');
  if(!billingReview&&!clinicalReview)return {ok:false,message:'Nothing needs review for this patient.'};
  const note=typeof payload?.note==='string'?payload.note.trim():'',author=typeof payload?.author==='string'?payload.author.trim():'';
  if(!note||note.length>4000)return {ok:false,message:'Enter a clarification of up to 4,000 characters.'};
  if(!author||author.length>100)return {ok:false,message:'Enter who is adding this clarification.'};
  const clarification={id:`${c.id}-clarification-${(c.clarifications||[]).length+1}`,at:s.now,author,note,kind:billingReview?'billing':'clinical'};
  (c.clarifications||=[]).push(clarification);
  if(billingReview){
   const b=c.billing;c.attention=null;if(b)b.clarification={...clarification};
   const estimate=b?`${money(b.share)} patient share${b.insurance?` (${money(b.fee)} fee, less the ${money(b.insurance)} ${b.plan} is expected to cover)`:' (self-pay)'}`:'';
   if(c.contact)say(s,c,`${author} added this clarification: “${note}”${estimate?`\n\nYour current estimate is ${estimate}.`:''} Would you like to find a time?`,'agent',[
    {id:clarification.id,kind:'chart',title:'Front desk clarification',source:`${author} · ${fmtDate(s.now)}`,text:note},
    ...(b?[{id:'billing',kind:'chart',title:'Insurance & billing',source:c.name,text:estimate}]:[])
   ]);
   event(s,c,'Estimate clarified',`${author}: ${note}`);
  }else{
   c.note=`${author} · ${fmtDate(s.now)}: ${note}`;
   const response=composeAnswer(c,'why',context.knowledge??loadKnowledge().entries);c.sources=response.sources.map(x=>x.id);
   if(c.contact)say(s,c,`${author} added the reason to your chart. ${response.text}`,'agent',response.sources);
   event(s,c,'Reason added to chart',`${author}: ${note}`);
  }
  if(c.contact&&!c.appointment&&c.status!=='paused'){c.status='engaged';c.stage='explained';c.wakeAt=null;}
  return {ok:true,message:`Clarification saved${c.contact?` and shared with ${c.name.split(' ')[0]}`:''}.`};
 }
 if(type==='pay'||type==='payatvisit'){
  if(!c.billing||!c.appointment||c.appointment.kind!=='Treatment')return {ok:false,message:'Payment is for a booked treatment visit.'};
  if(!c.contact)return {ok:false,message:'Messages are stopped. The front desk collects payment at the visit.'};
  const due=balance(c);if(due<=0)return {ok:false,message:'Already paid. No balance due.'};
  if(type==='payatvisit'){
   if(c.billing.payAtVisit)return {ok:false,message:'Already noted: paying at the visit.'};
   patient(s,c,'I’ll pay at the visit');c.billing.payAtVisit=true;
   say(s,c,`No problem. The front desk will collect ${money(due)} when you check in on ${fmtFull(c.appointment.start)}. You can still pay here any time before then.`);
   event(s,c,'Will pay at the visit',`Front desk to collect ${money(due)} at check-in.`);
   return {ok:true,message:`${c.name} will pay at the visit.`};
  }
  const card=`Visa ending ${cardEnding(c)}`,method=`${card} · authorized by text`,n=c.billing.payments.length;
  patient(s,c,`Pay ${money(due)} with my card ending ${cardEnding(c)}`);
  s.paySeq=(s.paySeq||0)+1;c.billing.payments.push({id:`${c.id}-pay${n+1}`,at:s.now,seq:s.paySeq,amount:due,method,receipt:`R-${c.chartId||c.id}-${n+1}`});c.billing.payAtVisit=false;
  say(s,c,`Thanks, ${c.name.split(' ')[0]}. ${money(due)} was charged to your ${card}. Your balance is now ${money(balance(c))}. Receipt ${c.billing.payments.at(-1).receipt}.${c.billing.insurance?` We’ll bill ${c.billing.plan} for the ${money(c.billing.insurance)} estimate.`:''} See you ${fmtFull(c.appointment.start)} at ${fmtTime(c.appointment.start)}.`);
  event(s,c,'Payment received',`Patient authorized ${money(due)} by text · ${card}.${c.billing.insurance?` Insurance estimate of ${money(c.billing.insurance)} to be billed to ${c.billing.plan}.`:''} Treatment completion still comes from treatment history.`);
  return {ok:true,message:`${c.name} paid ${money(due)} by text. Billing updated in Integrations.`};
 }
 if(type==='cancel'){
  if(!c.appointment||c.sourceStatus==='completed')return {ok:false,message:'No active appointment to cancel.'};
  if(c.contact)patient(s,c,'I need to cancel my appointment');c.appointment=null;c.wakeAt=null;c.status=c.contact?'engaged':'stopped';c.stage='cancelled';
  event(s,c,'Appointment cancelled','Scheduling record updated. Previous slot released; Clara offered to find another time.');
  const kept=paid(c);if(c.contact)say(s,c,`Your appointment has been cancelled.${kept?` Your ${money(kept)} payment stays on file for your next visit.`:''} I can find another time, or reconnect when it works better for you.`);return {ok:true,message:'Appointment cancelled. Clara offered another time.'};
 }
 if(!canReply(c))return {ok:false,message:'This conversation is closed.'};
 if(type==='faq'){
  const entries=context.knowledge??loadKnowledge().entries,entry=entries.find(e=>e.id===payload);
  if(!entry)return {ok:false,message:'That answer was removed. Choose a current practice question.'};
  const response=composeAnswer(c,'faq',entries,payload);patient(s,c,entry.question);say(s,c,response.text,'agent',response.sources);
  if(['waiting','eligible'].includes(c.status)){c.status='engaged';c.stage='explained';c.wakeAt=null;}
  event(s,c,response.requiresDentist?'Dentist discussion offered':'Practice question answered',`${entry.question} · saved guidance and relevant patient records checked.`);
  return {ok:true,message:''};
 }
 if(type==='stop'){patient(s,c,'Stop messages');c.contact=false;c.wakeAt=null;c.stage='done';say(s,c,'Messages stopped. You can still contact Cedar Dental directly. Any existing appointment remains booked.');event(s,c,'Contact preference updated','All future coordinator outreach suppressed.');return {ok:true,message:'Future outreach stopped.'};}
 if(type==='decline'){if(c.appointment)return {ok:false,message:'Cancel the appointment before declining treatment.'};patient(s,c,'I don’t want to proceed');c.status='declined';c.stage='done';c.wakeAt=null;say(s,c,'Understood. I won’t follow up on this recommendation again. You can contact the practice if you change your mind.');event(s,c,'Patient declined','Coordination closed. The clinical recommendation remains in the source record.');return {ok:true,message:'Patient decision recorded.'};}
 if(type==='keep'){
  if(!c.appointment||c.stage!=='slots')return {ok:false,message:'No change in progress.'};
  patient(s,c,'Keep my current appointment');c.stage='booked';c.consult=c.appointment.kind==='Discussion';
  say(s,c,`No problem. You’re still booked for ${fmtFull(c.appointment.start)} at ${fmtTime(c.appointment.start)}.`);
  return {ok:true,message:''};
 }
 if(c.appointment&&!['slots','treatment'].includes(type)&&type!=='book')return {ok:false,message:'Change or cancel the existing appointment first.'};
 const prevWake=c.wakeAt;c.wakeAt=null;
 if(type==='why'){
  if(c.stage==='explained'){c.wakeAt=prevWake;return {ok:false,message:'Explanation already shown.'};}patient(s,c,'Why was this treatment recommended?');c.barrier='Treatment understanding';c.status='engaged';c.stage='explained';
  const response=composeAnswer(c,'why',context.knowledge??loadKnowledge().entries);
  say(s,c,response.text,'agent',response.sources);c.sources=response.sources.map(x=>x.id);
  event(s,c,'Recommendation explained',response.requiresDentist?'Clinical clarification offered; saved guidance and patient chart checked.':'Used the current patient chart and saved practice knowledge.');
 }else if(type==='visit'){
  if(c.visitInfo){c.wakeAt=prevWake;return {ok:false,message:'Visit information already shared.'};}c.visitInfo=true;
  patient(s,c,'What happens at the appointment?');c.status='engaged';c.stage='explained';const response=composeAnswer(c,'visit',context.knowledge??loadKnowledge().entries);say(s,c,response.text,'agent',response.sources);c.sources=response.sources.map(x=>x.id);event(s,c,'Visit information shared','Used the current treatment plan and saved practice knowledge.');
 }else if(type==='consult'){
  patient(s,c,'I’d like to discuss this with the dentist');c.consult=true;c.stage='slots';c.status='engaged';say(s,c,'Of course. Here are 30-minute discussion appointments with Dr. Shah. This gives you time to ask questions before making a treatment decision.');event(s,c,'Discussion requested','Showing discussion times with Dr. Shah; treatment remains outstanding.');
 }else if(type==='treatment'){
  if(!c.consult){c.wakeAt=prevWake;return {ok:false,message:'Already looking at treatment times.'};}
  if(c.note.includes('does not include the patient-specific rationale')){c.wakeAt=prevWake;return {ok:false,message:'The dentist needs to add the reason before treatment is booked.'};}
  patient(s,c,'I’d like to book the treatment');c.consult=false;c.stage='slots';c.status=c.appointment?c.status:'engaged';
  say(s,c,`Here are times for your ${spoken(c.treatment)} with Dr. Lee (${c.duration||60} minutes).${c.appointment?' Your discussion stays booked until you confirm a treatment time.':''}`);
  event(s,c,'Treatment times requested','Patient chose to book treatment; showing Dr. Lee’s availability.');
 }else if(type==='slots'){
  patient(s,c,c.appointment?'I need a different time':c.consult?'Find a discussion time':'I’m ready to find a time');if(!c.appointment)c.status='engaged';c.stage='slots';if(c.barrier==='Unknown')c.barrier='Scheduling';say(s,c,c.appointment?'Choose a replacement time. Your current appointment stays booked until you confirm the new one.':'These times match your current plan. Choose one and I’ll confirm it with the practice.');
 }else if(type==='book'){
  const choice=slots(s,c).find(x=>x.id===payload);if(!choice){c.wakeAt=prevWake;return {ok:false,message:'That time is no longer available. Choose a refreshed option.'};}
  const prior=c.appointment;patient(s,c,`Confirm ${fmtFull(choice.start)} at ${fmtTime(choice.start)}`);c.appointment=choice;c.status='booked';c.stage='booked';
  if(prior&&c.billing)c.billing.payAtVisit=false;
  say(s,c,`${choice.kind==='Discussion'?`You’re booked for a ${choice.duration}-minute discussion with ${choice.provider}`:`You’re booked for your ${spoken(c.treatment)} with ${choice.provider}`} on ${fmtFull(choice.start)} at ${fmtTime(choice.start)} at Cedar Dental.${choice.kind==='Discussion'?'':` Allow ${choice.duration} minutes.`} You can change or cancel here.`);event(s,c,prior?'Appointment rescheduled':'Appointment booked',`${choice.provider} · ${choice.duration} minutes. Availability rechecked; ${prior?'original slot released after confirmation.':'scheduling follow-ups stopped.'}`);requestPayment(s,c);
 }else if(type==='pause'){
  if(c.appointment)return {ok:false,message:'Cancel your appointment before pausing scheduling.'};patient(s,c,'Contact me next week');c.status='paused';c.stage='paused';c.wakeAt=s.now+7*DAY;while([0,6].includes(new Date(c.wakeAt).getUTCDay()))c.wakeAt+=DAY;
  say(s,c,`I’ll reconnect on ${fmtFull(c.wakeAt)}. No scheduling follow-ups until then. You can return here sooner if you’re ready.`);event(s,c,'Patient requested a pause',`One follow-up scheduled for ${fmtFull(c.wakeAt)}. Earlier reminders removed.`);
 }else{c.wakeAt=prevWake;return {ok:false,message:'Unknown action.'};}
 return {ok:true,message:''};
}
export function advance(s){const due=s.cases.filter(c=>c.contact&&!c.appointment&&c.wakeAt).map(c=>c.wakeAt);s.now=due.length?Math.max(s.now+1,Math.min(...due)):s.now+DAY;processDue(s);return `Practice clock advanced to ${fmtFull(s.now)}.`;}

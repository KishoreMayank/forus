export const VERSION = 1;
export const DAY = 86400000;
export const START = Date.UTC(2026,9,12,9);
export const knowledge = [
 {id:'crown', title:'Understanding a recommended crown', category:'Treatment understanding', source:'Practice-approved patient guide', updated:'Oct 8, 2026', text:'A crown covers and supports a tooth. A dentist may recommend one when the remaining tooth needs protection. The patient’s own clinical record supplies the reason for their recommendation; this guide does not establish a diagnosis.'},
 {id:'visit', title:'What happens at the visit', category:'Patient experience', source:'Cedar Dental care team', updated:'Oct 8, 2026', text:'The dental team reviews the planned treatment and answers questions before beginning. The booked visit follows the existing treatment plan. Patients can ask to discuss the recommendation before deciding to proceed.'},
 {id:'schedule', title:'Finding the right appointment', category:'Scheduling', source:'Practice scheduling configuration', updated:'Oct 9, 2026', text:'For these sample plans, reserve 60 minutes with Dr. Lee for treatment, or 30 minutes with Dr. Shah for a discussion. Check current availability before confirming. A consultation does not complete the treatment plan.'}
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
export function ledger(s){return s.cases.flatMap(c=>(c.billing?.payments||[]).map(p=>({...p,caseId:c.id,name:c.name,treatment:c.treatment}))).sort((a,b)=>(b.at-a.at)||((b.seq||0)-(a.seq||0)));}
export function event(s,c,title,detail){ c.events.push({id:`${c.id}-${c.events.length}`,at:s.now,title,detail}); }
function say(s,c,text,who='agent',sources=[]){c.messages.push({id:`${c.id}-m${c.messages.length}`,at:s.now,who,text,sources});}
function patient(s,c,text){say(s,c,text,'patient');}
const base = (id,name,initials,color,barrier,note) => ({id,name,initials,color,barrier,note,treatment:'Crown · tooth 30',sourceStatus:'active',status:'eligible',stage:'outreach',contact:true,appointment:null,wakeAt:null,attempts:0,messages:[],events:[],sources:[],consult:false});
export function seed(){const s={version:VERSION,now:START,selected:'maya',view:'admin',page:'patients',tab:'conversation',cases:[
 base('maya','Maya Chen','MC','lilac','Treatment understanding','Dr. Lee · Oct 9: Tooth 30 has a recorded crack. A crown was recommended to protect and support the remaining tooth.'),
 base('jordan','Jordan Ellis','JE','blue','Scheduling','Dr. Lee · Oct 9: Tooth 30 has a recorded crack. A crown was recommended to protect and support the remaining tooth. Patient asked for help finding a time.'),
 base('alex','Alex Morgan','AM','peach','Treatment understanding','Dr. Lee · Oct 9: Crown recommended for tooth 30. The synced note does not include the patient-specific rationale.')
]};s.cases.forEach(attachBilling);processDue(s);return s;}
export function processDue(s){for(const c of s.cases){
 if(!c.contact||c.sourceStatus==='completed'||c.appointment||['declined','closed'].includes(c.status))continue;
 if(c.status==='eligible'){say(s,c,c.outreach||`Hi ${c.name.split(' ')[0]}, I’m Clara, Cedar Dental’s AI assistant. You have a crown recommendation from Dr. Lee that hasn’t been scheduled. I can help you understand the recommendation or find a time. What would be helpful?`);c.status='waiting';c.attempts=1;c.wakeAt=s.now+3*DAY;event(s,c,'Follow-up started','Current plan and contact preferences checked. Initial message sent automatically.');}
 else if(c.wakeAt&&s.now>=c.wakeAt){
 if(c.status==='paused'){c.status='engaged';c.stage='slots';c.wakeAt=null;say(s,c,`Hi ${c.name.split(' ')[0]}, you asked me to reconnect today. I’ve checked the current plan and availability. Would you like to find a time${c.consult?' to discuss the recommendation':''}?`);event(s,c,'Resumed as requested','Remembered the requested date and checked for an existing booking before contacting the patient.');}
 else if(c.status==='waiting'){if(c.attempts<3){c.attempts++;say(s,c,'Checking back on your recommended care. I can help explain the recorded recommendation, find a time, or pause these messages.');c.wakeAt=s.now+(c.attempts===2?4:3)*DAY;event(s,c,'Follow-up sent',`Attempt ${c.attempts} of 3. No booking or contact hold found.`);}else{c.status='closed';c.wakeAt=null;event(s,c,'Outreach concluded','No reply after three messages. Treatment remains outstanding; no further outreach is scheduled.');}}
 }
}}
export function slots(s,c){const out=[];let d=s.now+DAY;while(out.length<3){const date=new Date(d);const day=date.getUTCDay();if(day!==0&&day!==6){const start=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),out.length===1?14:10);const id=`${start}-${c.consult?'shah':'lee'}`;if(!s.cases.some(x=>x.appointment?.id===id)){out.push({id,start,duration:c.consult?30:(c.duration||60),provider:c.consult?'Dr. Shah':'Dr. Lee',kind:c.consult?'Discussion':'Treatment'});}}d+=DAY;}return out;}
export function nextAction(c){if(!c.contact)return 'Contact stopped';if(c.sourceStatus==='completed')return 'No further follow-up';if(c.appointment)return `${c.appointment.kind} · ${fmtFull(c.appointment.start)}`;if(c.wakeAt)return `${c.status==='paused'?'Reconnect':'Follow up'} · ${fmtDate(c.wakeAt)}`;if(c.status==='declined')return 'Patient chose not to proceed';if(c.status==='closed')return 'Outreach concluded';return 'Waiting for patient choice';}
export const statusLabel = c => !c.contact?'Contact stopped':({eligible:'Ready',waiting:'Awaiting reply',engaged:'In conversation',paused:'Paused',booked:c.consult?'Discussion booked':'Treatment booked',completed:'Completed',declined:'Declined',closed:'No response'}[c.status]||c.status);
export function canReply(c){return c.contact&&c.sourceStatus!=='completed'&&!['declined','closed'].includes(c.status);}
export function act(s,id,type,payload){const c=s.cases.find(x=>x.id===id);if(!c)return {ok:false,message:'Patient not found.'};
 if(type==='complete'){
  if(!c.appointment||c.appointment.kind!=='Treatment')return {ok:false,message:'A treatment appointment is required.'};
  s.now=Math.max(s.now,c.appointment.start+c.appointment.duration*60000);c.sourceStatus='completed';c.status='completed';c.stage='done';c.wakeAt=null;
  event(s,c,'Treatment confirmed complete','The simulated practice record confirms treatment completion. Pending follow-up removed.');return {ok:true,message:'Practice record updated. Treatment complete.'};
 }
 if(type==='pay'){
  if(!c.billing||!c.appointment||c.appointment.kind!=='Treatment')return {ok:false,message:'Payment is taken for a booked treatment visit.'};
  const due=balance(c);if(due<=0)return {ok:false,message:'Already paid. No balance due.'};
  const method=payload==='desk'?`${PAY_METHODS.desk}`:`${PAY_METHODS.card} · Visa ending ${cardEnding(c)}`;
  const n=c.billing.payments.length;
  s.paySeq=(s.paySeq||0)+1;c.billing.payments.push({id:`${c.id}-pay${n+1}`,at:s.now,seq:s.paySeq,amount:due,method,receipt:`R-${c.chartId||c.id}-${n+1}`});
  event(s,c,'Payment received',`${money(due)} patient share · ${method}. Insurance estimate of ${money(c.billing.insurance)} billed to ${c.billing.plan}. Treatment completion still comes from treatment history.`);
  return {ok:true,message:`${money(due)} received from ${c.name}. Billing updated in Integrations.`};
 }
 if(type==='cancel'){
  if(!c.appointment||c.sourceStatus==='completed')return {ok:false,message:'No active appointment to cancel.'};
  c.appointment=null;c.wakeAt=null;c.status=c.contact?'engaged':'stopped';c.stage='cancelled';
  event(s,c,'Appointment cancelled','Scheduling record updated. Previous slot released; coordination reopened.');
  if(c.contact)say(s,c,'Your appointment has been cancelled. I can find another time, or reconnect when it works better for you.');return {ok:true,message:'Appointment cancelled. Follow-up reopened.'};
 }
 if(!canReply(c))return {ok:false,message:'This conversation is closed.'};
 if(type==='stop'){patient(s,c,'Stop messages');c.contact=false;c.wakeAt=null;c.stage='done';say(s,c,'Messages stopped. You can still contact Cedar Dental directly. Any existing appointment remains booked.');event(s,c,'Contact preference updated','All future coordinator outreach suppressed.');return {ok:true,message:'Future outreach stopped.'};}
 if(type==='decline'){if(c.appointment)return {ok:false,message:'Cancel the appointment before declining treatment.'};patient(s,c,'I don’t want to proceed');c.status='declined';c.stage='done';c.wakeAt=null;say(s,c,'Understood. I won’t follow up on this recommendation again. You can contact the practice if you change your mind.');event(s,c,'Patient declined','Coordination closed. The clinical recommendation remains in the source record.');return {ok:true,message:'Patient decision recorded.'};}
 if(c.appointment&&!['slots'].includes(type)&&type!=='book')return {ok:false,message:'Change or cancel the existing appointment first.'};
 c.wakeAt=null;
 if(type==='why'){
  if(c.stage==='explained')return {ok:false,message:'Explanation already shown.'};patient(s,c,'Why was this treatment recommended?');c.barrier='Treatment understanding';c.status='engaged';c.stage='explained';
  if(c.explanation){say(s,c,c.explanation,'agent',['note']);}
  else if(c.id==='alex'){say(s,c,'A crown can support and protect a tooth, but your synced note doesn’t include why Dr. Lee recommended it for your tooth. I don’t want to guess. I can arrange a discussion with the dentist before you decide.','agent',['crown','note']);}
  else{say(s,c,'Dr. Lee’s note records a crack in tooth 30 and recommends a crown to protect and support the remaining tooth. A crown covers the tooth. The team can discuss your questions before treatment; you decide whether to proceed.','agent',['crown','note']);}
  c.sources=c.explanation?['note']:['crown','note'];event(s,c,'Recommendation explained',c.id==='alex'?'Missing patient-specific rationale disclosed; offered a dentist discussion.':(c.explanation?'Used the existing clinician note and recorded care plan.':'Used the existing clinician note and practice-approved crown guide.'));
 }else if(type==='visit'){
  patient(s,c,'What happens at the appointment?');c.status='engaged';c.stage='explained';say(s,c,`The team will review the planned treatment and answer your questions before beginning. Your sample treatment plan reserves ${c.duration||60} minutes with Dr. Lee. If you want to discuss the recommendation first, I can book a separate 30-minute discussion.`,'agent',['visit','schedule']);c.sources=['visit','schedule'];event(s,c,'Visit information shared','Practice guide and scheduling requirements referenced.');
 }else if(type==='consult'){
  patient(s,c,'I’d like to discuss this with the dentist');c.consult=true;c.stage='slots';c.status='engaged';say(s,c,'Of course. Here are 30-minute discussion appointments with Dr. Shah. This gives you time to ask questions before making a treatment decision.');event(s,c,'Discussion requested','Switched to consultation availability; treatment remains outstanding.');
 }else if(type==='slots'){
  if(!c.appointment){patient(s,c,c.consult?'Find a discussion time':'I’m ready to find a time');c.status='engaged';}c.stage='slots';if(c.barrier==='Unknown')c.barrier='Scheduling';say(s,c,c.appointment?'Choose a replacement time. Your current appointment stays booked until you confirm the new one.':'These times match your current plan. Choose one and I’ll confirm it with the practice.');
 }else if(type==='book'){
  const choice=slots(s,c).find(x=>x.id===payload);if(!choice)return {ok:false,message:'That time is no longer available. Choose a refreshed option.'};
  const prior=c.appointment;patient(s,c,`Confirm ${fmtFull(choice.start)} at ${fmtTime(choice.start)}`);c.appointment=choice;c.status='booked';c.stage='booked';
  say(s,c,`You’re booked for ${choice.kind.toLowerCase()} on ${fmtFull(choice.start)} at ${fmtTime(choice.start)} with ${choice.provider}, Cedar Dental. Allow ${choice.duration} minutes. You can change or cancel here.`);event(s,c,prior?'Appointment rescheduled':'Appointment booked',`${choice.provider} · ${choice.duration} minutes. Availability rechecked; ${prior?'original slot released after confirmation.':'scheduling follow-ups stopped.'}`);
 }else if(type==='pause'){
  if(c.appointment)return {ok:false,message:'Cancel your appointment before pausing scheduling.'};patient(s,c,'Contact me next week');c.status='paused';c.stage='paused';c.wakeAt=s.now+7*DAY;while([0,6].includes(new Date(c.wakeAt).getUTCDay()))c.wakeAt+=DAY;
  say(s,c,`I’ll reconnect on ${fmtFull(c.wakeAt)}. No scheduling follow-ups until then. You can return here sooner if you’re ready.`);event(s,c,'Patient requested a pause',`One follow-up scheduled for ${fmtFull(c.wakeAt)}. Earlier reminders removed.`);
 }else return {ok:false,message:'Unknown action.'};
 return {ok:true,message:''};
}
export function advance(s){const due=s.cases.filter(c=>c.contact&&!c.appointment&&c.wakeAt).map(c=>c.wakeAt);s.now=due.length?Math.max(s.now+1,Math.min(...due)):s.now+DAY;processDue(s);return `Practice clock advanced to ${fmtFull(s.now)}.`;}

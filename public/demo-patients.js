import {seed,processDue,act,slots,DAY,attachBilling,cardEnding,PAY_METHODS,requestPayment} from './engine.js?v=9';

// Additional fictional cases use the same workflow as the original demo.
const samples=[
 ['priya','Priya Shah',1148,'waiting'],
 ['daniel','Daniel Brooks',1162,'waiting'],
 ['olivia','Olivia Reed',1185,'engaged'],
 ['marcus','Marcus Williams',1201,'engaged'],
 ['sofia','Sofia Garcia',1224,'booked'],
 ['ethan','Ethan Park',1246,'booked'],
 ['nora','Nora Patel',1263,'paused'],
 ['grace','Grace Kim',1280,'completed'],
 ['ben','Ben Carter',1297,'declined']
];

// Fictional outstanding care plans; each follow-up uses its own recorded rationale.
const plans={
 priya:['Filling · tooth 14',45,'Dr. Lee recorded decay in tooth 14 and recommended a filling. Follow up to schedule the unfinished restoration.'],
 daniel:['Periodontal therapy · lower right',60,'Dr. Lee recommended periodontal therapy for the lower-right quadrant after the gum assessment. Follow up to schedule the recommended visit.'],
 olivia:['Root canal · tooth 19',90,'Dr. Lee recommended root canal treatment for tooth 19 following the recorded assessment. The patient requested an explanation before scheduling.'],
 marcus:['Extraction · tooth 16',45,'Dr. Lee recommended extraction of tooth 16 after documenting that it could not be restored. The patient has questions before booking.'],
 sofia:['Crown placement · tooth 3',45,'The crown for tooth 3 is ready. Dr. Lee requested a return visit for placement to complete the existing treatment plan.'],
 ethan:['Filling · tooth 5',45,'Dr. Lee recorded decay in tooth 5 and recommended a filling. The restoration is still outstanding.'],
 nora:['Periodontal maintenance',60,'The care team recommended a periodontal maintenance visit following completed gum therapy. The patient requested contact next week to schedule.'],
 grace:['Bite adjustment · tooth 12',30,'Following the restoration of tooth 12, Dr. Lee requested a return visit to assess and adjust the bite. The follow-up visit is now recorded as completed.'],
 ben:['Night guard fitting',30,'Dr. Lee recommended a night guard and a fitting visit after documenting tooth wear. The patient chose not to proceed with this recommendation.']
};
// Fictional contact details from the chart (555-01xx numbers are reserved for fiction).
const CONTACT={
 maya:['(555) 014-3308','Weekdays 9–6 · any time',45,'Sep 24 · exam'],
 jordan:['(555) 014-2291','Weekday afternoons',38,'Sep 30 · exam'],
 alex:['(555) 014-7752','Weekdays after 4 PM',52,'Oct 2 · exam'],
 priya:['(555) 014-1186','Mornings',29,'Sep 18 · cleaning'],
 daniel:['(555) 014-6640','Around shifts · texts first',41,'Sep 22 · gum assessment'],
 olivia:['(555) 014-3957','Weekdays 12–2',34,'Oct 1 · exam'],
 marcus:['(555) 014-8823','Evenings',57,'Sep 26 · exam'],
 sofia:['(555) 014-5410','Any time',47,'Sep 29 · crown prep'],
 ethan:['(555) 014-2075','Weekday mornings',23,'Sep 21 · exam'],
 nora:['(555) 014-9134','Later this month',62,'Aug 28 · gum therapy'],
 grace:['(555) 014-4468','Weekdays 9–6',36,'Oct 9 · bite adjustment'],
 ben:['(555) 014-7301','Evenings',44,'Sep 15 · exam'],
 'ella-cost':['(555) 014-6029','Weekdays after 3 PM',39,'Sep 25 · root canal']
};
// Patient-facing wording: keep the clinical reason, drop staff instructions from the chart note.
const forPatient=rationale=>rationale.split(/(?<=\.)\s+/).filter(x=>!/^(Follow up|The patient|Patient |The follow-up visit is now)/.test(x)).join(' ');
const spoken=treatment=>{const [what,where]=treatment.split(' · ');return (where?`${what} for ${/^tooth/.test(where)?'':'the '}${where}`:what).toLowerCase();};
function patientCopy(c,treatment,rationale){
 return {explanation:`${forPatient(rationale)} The team can answer questions before the visit; you decide whether to proceed.`,outreach:`Hi ${c.name.split(' ')[0]}, I’m Clara, Cedar Dental’s AI assistant. I’m following up on your recommended ${spoken(treatment)}. I can help with questions or find a time for the visit. What would be helpful?`};
}
function applyPlan(c){
 const plan=plans[c.id];if(!plan||c.planRevision===2)return;
 const [treatment,duration,rationale]=plan;
 if(c.planRevision===1){
  // Revision 2: earlier copy quoted staff notes ("The patient requested…") and raw labels to the patient.
  const before={explanation:c.explanation,outreach:c.outreach},after=patientCopy(c,treatment,rationale);
  for(const m of c.messages){if(m.text===before.explanation)m.text=after.explanation;if(m.text===before.outreach)m.text=after.outreach;}
  Object.assign(c,after,{planRevision:2});return;
 }
 Object.assign(c,{treatment,duration,note:`Dr. Lee · Oct 9: ${rationale}`,...patientCopy(c,treatment,rationale),planRevision:2});
 // Migrate existing fictional conversations without resetting patient decisions.
 for(const m of c.messages){
  if(m.who==='agent'&&m.text.includes('crown recommendation'))m.text=c.outreach;
  if(m.who==='agent'&&m.sources?.includes('crown')){m.text=c.explanation;m.sources=['note'];}
  m.text=m.text.replace('60 minutes with Dr. Lee',`${duration} minutes with Dr. Lee`).replace('Allow 60 minutes',`Allow ${duration} minutes`);
 }
 c.sources=c.sources.filter(x=>x!=='crown');
 if(c.appointment?.kind==='Treatment')c.appointment.duration=duration;
 for(const e of c.events){e.detail=e.detail.replace('practice-approved crown guide','recorded care plan').replace('60 minutes',`${duration} minutes`);}
}

const threadStarters={
 maya:['Is this about the tooth we discussed at my last visit?','Yes—the crown recommended for tooth 30. I’m following up because it has not been scheduled.','I have a few questions before I book.','Of course. What would you like to understand about the recommendation?'],
 jordan:['Can you help me find a time next week?','Yes. I can check openings for your recommended crown appointment.','Afternoons are usually easier for me.','Let’s look at available times. I’ll confirm the appointment only after you choose one.'],
 alex:['I’m not sure I understand why this was recommended.','The synced note lists the crown recommendation, but does not include the reason for your tooth.','Can I talk it through with someone first?','Yes. I can help arrange a discussion with the dentist before you decide.'],
 priya:['Is this for the filling from my last checkup?','Yes, the recommended filling for tooth 14. It is still listed as outstanding in your care plan.','How much time should I set aside?','The plan reserves 45 minutes with Dr. Lee. Would you like me to find a time?'],
 daniel:['Is this the gum treatment we talked about?','Yes—the recommended periodontal therapy for the lower-right area.','I need to work around my shifts.','The planned visit is 60 minutes. Which days tend to work best for you?'],
 olivia:['I saw the recommendation, but I have some questions.','Of course. This follow-up is about the root canal recommended for tooth 19.','Can I understand the plan before choosing a time?','Yes. We can review what is recorded, or arrange a discussion with the dentist.'],
 marcus:['Is this about removing the tooth?','Yes, the extraction recommended for tooth 16. It has not been scheduled.','I’m a little unsure about going ahead.','You can ask questions before deciding. What would you like to know?'],
 sofia:['Has my crown come back yet?','Yes, the chart says the crown for tooth 3 is ready for placement.','Great. I’d like to get that finished.','I can help schedule the return visit. The plan reserves 45 minutes.'],
 ethan:['I still need to book that filling.','I can help. The outstanding recommendation is for tooth 5.','Would next week be possible?','Let’s check the calendar for a 45-minute appointment with Dr. Lee.'],
 nora:['Is this my follow-up after the gum treatment?','Yes, the recommended periodontal maintenance visit.','This week is a little busy.','We can work around that. You can choose a later visit or ask me to reconnect.'],
 grace:['I wanted to follow up about my bite after the filling.','The chart includes a return visit to assess and adjust the bite on tooth 12.','Can you help me arrange that visit?','Yes. The recorded plan reserves 30 minutes with Dr. Lee.'],
 ben:['Is this about the night guard?','Yes, I’m following up on the recommended fitting visit.','I’m still deciding whether to go ahead.','That’s okay. You can ask questions or let us know your decision.']
};
function populateThread(c){
 if(c.threadRevision===1||!c.messages.length)return;
 const lines=threadStarters[c.id];if(!lines)return;
 const first=c.messages[0],at=first.at;
 first.at=at-4*60000;
 const extra=lines.map((text,i)=>({id:`${c.id}-intro-${i}`,at:at-(3-i)*60000,who:i%2===0?'patient':'agent',text,sources:[]}));
 c.messages.splice(1,0,...extra);c.threadRevision=1;
}

export function extendPatients(state){
 const originalCharts={maya:1042,jordan:1087,alex:1103};
 for(const c of state.cases){c.chartId??=originalCharts[c.id];applyPlan(c);}
 for(const [id,name,chartId,status] of samples){
  if(state.cases.some(c=>c.id===id))continue;
  const c={...seed().cases[0],billing:null,id,name,chartId,initials:name.split(' ').map(n=>n[0]).join(''),status:'eligible',attempts:0,wakeAt:null,messages:[],events:[],sources:[]};
  applyPlan(c);
  state.cases.push(c);
  processDue({...state,cases:[c]});
  if(status==='engaged')act(state,id,'why');
  if(status==='paused')act(state,id,'pause');
  if(status==='declined')act(state,id,'decline');
  if(['booked','completed'].includes(status)){
   act(state,id,'slots');act(state,id,'book',slots(state,c)[0].id);
   if(status==='completed'){
    // Historical appointment: adding the fixture must not advance the demo clock.
    c.appointment.start=state.now-3*DAY;c.appointment.id=`historical-${id}`;
    c.messages=c.messages.filter(m=>!m.text.startsWith('Confirm ')&&!m.text.startsWith('You’re booked'));
    act(state,id,'complete');
   }
  }
 }
 // Fictional front-desk handoff example; independent of existing patient decisions.
 if(!state.cases.some(c=>c.id==='ella-cost')){
  const c={...seed().cases[0],billing:null,id:'ella-cost',name:'Ella Wilson',initials:'EW',chartId:1314,treatment:'Crown · tooth 19',note:'Dr. Lee · Oct 9: Crown recommended to restore tooth 19 after root canal treatment. An itemized estimate has not yet been confirmed.',status:'engaged',stage:'explained',appointment:null,wakeAt:null,attempts:0,consult:false,sources:[],contact:true,sourceStatus:'active',attention:{owner:'Front desk',reason:'Asked what it will cost',title:'Confirm the treatment estimate',detail:'Review the planned fees and insurance benefits, then explain the estimated patient share before scheduling.'},messages:[{id:'ella-cost-question',who:'patient',at:state.now-120000,text:'Before I book, how much will the crown cost after insurance?',sources:[],channel:'sms'},{id:'ella-cost-reply',who:'agent',at:state.now-60000,text:'The front desk needs to confirm your treatment estimate and insurance benefits. They can explain the estimated amount you would pay before you choose an appointment.',sources:[],channel:'sms'}],events:[{at:state.now-120000,title:'Patient asked about cost',detail:'Requested an estimate of the amount due after insurance.'},{at:state.now-60000,title:'Front desk review needed',detail:'Confirm fees, coverage, and the estimated patient share before scheduling.'}],threadRevision:1,channelRevision:1};
  state.cases.push(c);
 }
 for(const c of state.cases){
  attachBilling(c);
  // Booked treatment visits get Clara’s payment request once (also for demos saved before payments moved to text).
  requestPayment(state,c);
  if(!c.contactInfo&&CONTACT[c.id]){const [phone,bestTime,age,lastVisit]=CONTACT[c.id];c.contactInfo={phone,bestTime,age,lastVisit};}
  // History: Grace paid her share at the completed bite-adjustment visit.
  if(c.id==='grace'&&c.sourceStatus==='completed'&&!c.billing.payments.length&&c.appointment)c.billing.payments.push({id:'grace-pay1',at:c.appointment.start+c.appointment.duration*60000,amount:c.billing.share,method:`${PAY_METHODS.card} · Visa ending ${cardEnding(c)}`,receipt:`R-${c.chartId}-1`});
  populateThread(c);
  if(c.outreach)c.outreach=c.outreach.replace('this is Cedar Dental’s automated care coordinator','I’m Clara, Cedar Dental’s AI assistant');
  for(const m of c.messages)if(m.who==='agent')m.text=m.text.replace('this is Cedar Dental’s automated care coordinator','I’m Clara, Cedar Dental’s AI assistant');
  // Earlier email exchanges and subsequent texts share one chronological thread.
  if(c.channelRevision!==1){
   for(const [i,m] of c.messages.entries())m.channel=i<3?'email':'sms';
   c.channelRevision=1;
  }
 }
 return state;
}

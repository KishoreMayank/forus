import {costInsuranceEntries} from './cost-insurance.js?v=2';
import {treatmentTopics,treatmentEntries,visitEntries} from './treatment-knowledge.js?v=3';
export const key='cedar-knowledge-v2';
export const DELETED_KEY='cedar-knowledge-deleted-v1';
export const BUILT_IN_TOPICS=[...treatmentTopics,'General','Scheduling','Cost & Insurance','Communication'];
const oldKey='cedar-practice-faq-v1';
const emptyStorage={getItem:()=>null,setItem:()=>{}};
export function loadKnowledge(storage){
 if(!storage&&typeof window!=='undefined'){try{storage=globalThis.localStorage;}catch{}}
 storage ||= emptyStorage;
const topics=[...BUILT_IN_TOPICS];
let deletedIds=[];try{const d=JSON.parse(storage.getItem(DELETED_KEY));if(Array.isArray(d))deletedIds=d;}catch{}
try{const saved=JSON.parse(storage.getItem('cedar-custom-topics-v1'));if(Array.isArray(saved))for(const t of saved)if(typeof t==='string'&&t.trim()&&!topics.includes(t))topics.push(t);}catch{}
const topicMap={'Treatment questions':'General',Appointments:'Scheduling','Follow-up':'Communication',Practice:'Communication'};
const defaults=[{"id": "faq-0", "topic": "Crowns", "question": "Why was a crown recommended?", "answer": "Use the clinician’s recorded reason for this patient. For example, Maya’s note records a crack in tooth 30 and a recommendation to protect and support the remaining tooth. General practice guidance explains what a crown does; it does not establish why a particular patient needs one.", "source": "Patient chart + practice crown guide", "chart": true}, {"id": "faq-1", "topic": "Crowns", "question": "What does a crown do?", "answer": "A crown covers and supports a tooth. It may be recommended when the remaining tooth needs protection. The patient’s clinical note provides the reason for their own recommendation.", "source": "Practice-approved crown guide", "chart": false}, {"id": "faq-2", "topic": "Appointments", "question": "What happens at the appointment?", "answer": "The dental team reviews the existing treatment plan and answers questions before beginning. Patients can ask to discuss the recommendation before deciding to proceed.", "source": "Cedar Dental care team", "chart": false}, {"id": "faq-3", "topic": "Appointments", "question": "Can a patient speak with the dentist before deciding?", "answer": "Yes. Offer a separate discussion appointment if the patient has unresolved questions. The sample schedule reserves 30 minutes with Dr. Shah. A discussion does not count as completed treatment.", "source": "Practice scheduling guidance", "chart": false}, {"id": "faq-4", "topic": "Appointments", "question": "How is the right appointment selected?", "answer": "Use the duration and provider requirements in the existing treatment plan, then check the practice calendar. Visit lengths vary by the recorded care plan, from 30-minute follow-up visits to 90-minute treatment appointments. Confirm the patient’s chosen time before booking.", "source": "Treatment plan + practice calendar", "chart": false}, {"id": "faq-5", "topic": "Follow-up", "question": "What if the patient wants to reschedule or wait?", "answer": "Offer another available appointment or record the requested follow-up date. Keep an existing appointment until a replacement is confirmed. Pause scheduling messages until the patient’s requested date.", "source": "Practice follow-up rules", "chart": false}, {"id": "faq-6", "topic": "Follow-up", "question": "What if the record cannot answer a question?", "answer": "Explain what information is missing and offer to schedule a discussion with the dentist. Do not invent a diagnosis, patient-specific rationale, or urgency.", "source": "Practice communication guidance", "chart": false}];
// Patient-facing guidance, kept separate from each patient's recorded rationale.
const crownWhy='Crowns are usually recommended when a tooth is cracked, weakened by a large filling, or has had a root canal. Your dentist can explain how this applies to your tooth before you decide.';
defaults[0].answer=crownWhy;
let entries=defaults;
try{const saved=JSON.parse(storage.getItem(key));if(Array.isArray(saved)&&saved.every(e=>e.id&&typeof e.topic==='string'&&typeof e.question==='string'&&typeof e.answer==='string'&&typeof e.source==='string'))entries=saved;else{const old=JSON.parse(storage.getItem(oldKey));if(Array.isArray(old))entries=entries.concat(old.filter(e=>typeof e.question==='string'&&typeof e.answer==='string'&&typeof e.source==='string').map((e,i)=>({...e,id:`custom-${i}`,topic:'Practice'})));}}catch{}

entries=entries.map(e=>({...e,topic:topicMap[e.topic]||e.topic}));
// Expand the starter library once; preserve subsequent practice edits and removals.
if(!storage.getItem('cedar-knowledge-organized-v1')){
 entries=entries.map(e=>e.id==='faq-3'||e.id==='faq-6'?{...e,topic:'Treatment questions'}:e.id==='faq-5'?{...e,topic:'Scheduling'}:e);
 const additions=[
  ['treatment-alternatives','Treatment questions','Could another treatment work instead?','Your dentist can discuss alternatives using your examination and treatment history. I can help arrange that conversation before you decide.','Practice communication guidance'],
  ['treatment-timing','Treatment questions','Can I wait before having treatment?','The right timing depends on your individual situation. I can help you ask the dentist about timing; the general FAQ cannot determine how long it is safe for you to wait.','Practice communication guidance'],
  ['scheduling-duration','Scheduling','How long should I allow for my visit?','The appointment length comes from your treatment plan. I will include the reserved duration when offering times and confirming your appointment.','Practice scheduling guidance'],
  ['scheduling-change','Scheduling','Can I change an appointment that is already booked?','Yes. You can request another time. Your existing appointment stays booked until you confirm a replacement. If you want to cancel without rebooking, please say so explicitly.','Practice scheduling guidance'],
  ['communication-pause','Communication','Can you contact me later?','Yes. Let me know when you would like us to reconnect. Scheduling follow-ups will pause until the agreed date.','Practice follow-up guidance'],
  ['communication-stop','Communication','Will stopping messages cancel my appointment?','No. Stopping follow-up messages leaves an existing appointment in place. Please request cancellation separately if you no longer want that appointment.','Practice communication guidance'],
  ['communication-human','Communication','Can I speak with someone at the practice?','Yes. You can contact the practice directly. If your question is about the recommended care, I can also help arrange a discussion with the dentist.','Practice communication guidance'],
  ['communication-identity','Communication','Who am I speaking with?','I’m Clara, Cedar Dental’s AI assistant. I help with questions about recorded care recommendations and coordinate appointments. Your dentist makes clinical recommendations.','Practice communication guidance']
 ];
 for(const [id,section,question,answer,source] of additions)if(!entries.some(e=>e.id===id||e.question.toLowerCase()===question.toLowerCase()))entries.push({id,topic:section,question,answer,source,chart:false});
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-knowledge-organized-v1','1');}catch{}
}
const answerUpdates={
 'faq-3':['Can I speak with the dentist before deciding?','Yes. I can help arrange a separate discussion with the dentist so you can ask questions before making a treatment decision.'],
 'faq-4':['How do you choose the right appointment?','I use the visit length and provider listed in your treatment plan, then check available times. Nothing is booked until you confirm your choice.'],
 'faq-5':['What if I need to reschedule or wait?','I can help find another available time or pause scheduling follow-ups until an agreed date. An existing appointment stays in place unless you confirm a change or cancellation.'],
 'faq-6':['What if my chart does not answer my question?','I will explain what information is missing and help arrange a discussion with the dentist. I will not guess why a treatment was recommended or how urgently you need it.']
};
if(!storage.getItem('cedar-knowledge-copy-v1')){
 entries=entries.map(e=>answerUpdates[e.id]&&!e.updated?{...e,question:answerUpdates[e.id][0],answer:answerUpdates[e.id][1]}:e);
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-knowledge-copy-v1','1');}catch{}
}
entries=entries.map(e=>({...e,topic:topicMap[e.topic]||e.topic}));
if(!storage.getItem('cedar-treatment-library-v1')){
 entries=entries.map(e=>({...e,dentist:e.dentist||['treatment-alternatives','treatment-timing','faq-6'].includes(e.id)}));
 for(const entry of treatmentEntries)if(!entries.some(e=>e.id===entry.id||e.question===entry.question))entries.push(entry);
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-treatment-library-v1','1');}catch{}
}
// Add the billing library once without replacing practice edits.
if(!storage.getItem('cedar-cost-insurance-v1')){
 for(const entry of costInsuranceEntries)if(!entries.some(e=>e.id===entry.id))entries.push({...entry});
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-cost-insurance-v1','1');}catch{}
}
// Content refresh v2: fictional practice sources (no outside sites), billing answers that match pay-by-text,
// and patient-voice wording. Entries a staff member edited (updated:true) keep their text.
if(!storage.getItem('cedar-knowledge-copy-v2')){
 const builtIn=new Map([...costInsuranceEntries,...treatmentEntries].map(e=>[e.id,e]));
 builtIn.set('faq-1',{question:'What does a crown do?',answer:'A crown is a cap that covers the whole tooth to protect and strengthen it. Your dentist can explain why it was recommended for your tooth.'});
 builtIn.set('faq-2',{question:'What happens at the appointment?',answer:'The team will review your treatment plan and answer your questions before starting. If you’d like to talk it through first, I can book a separate discussion with the dentist.'});
 entries=entries.map(e=>{
  const fresh=builtIn.get(e.id);let next={...e};
  if(/mouthhealthy|nhs\.uk|ada\.org/i.test(next.source||''))next.source=fresh?.source||(next.topic==='Cost & Insurance'?'Cedar Dental billing guide · payments':'Cedar Dental patient guide · treatments');
  if(fresh&&!e.updated)next={...next,question:fresh.question,answer:fresh.answer,...(fresh.source?{source:fresh.source}:{})};
  return next;
 });
 for(const entry of costInsuranceEntries)if(!entries.some(e=>e.id===entry.id))entries.push({...entry});
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-knowledge-copy-v2','1');}catch{}
}
// Content v3: a General section for treatment-wide questions, tailored "what to expect" answers,
// no duplicate "alternatives" answers. Staff edits (updated:true) and deletions are respected.
if(!storage.getItem('cedar-knowledge-v3')){
 const general=['faq-3','faq-6','treatment-alternatives','treatment-timing'];
 const visits=new Map(visitEntries.map(e=>[e.id,e]));
 entries=entries
  .filter(e=>!(/^kb-.+-alternatives$/.test(e.id)&&!e.updated))
  .map(e=>{
   let next=e;
   if(general.includes(e.id)&&e.topic==='Crowns')next={...next,topic:'General'};
   if(visits.has(e.id)&&!e.updated)next={...next,question:visits.get(e.id).question,answer:visits.get(e.id).answer,source:visits.get(e.id).source};
   if(e.id==='faq-0'&&!e.updated)next={...next,answer:crownWhy};
   return next;
  });
 for(const v of visitEntries)if(!entries.some(e=>e.id===v.id)&&!deletedIds.includes(v.id))entries.push({...v});
 try{storage.setItem(key,JSON.stringify(entries));storage.setItem('cedar-knowledge-v3','1');}catch{}
}
entries=entries.filter(e=>!deletedIds.includes(e.id));
try{storage.setItem(key,JSON.stringify(entries));}catch{}
return {entries,topics,deletedIds};
}

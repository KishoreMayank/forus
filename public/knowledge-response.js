// Deterministic prototype composition: saved practice guidance + this patient's records.
// This module is shared by the Knowledge preview and patient conversations.
export function treatmentTopic(c){
 const t=String(c.treatment||'').toLowerCase();
 if(t.includes('crown'))return 'Crowns';
 if(t.includes('filling'))return 'Fillings';
 if(t.includes('root canal'))return 'Root canals';
 if(t.includes('periodontal')||t.includes('gum'))return 'Gum care';
 if(t.includes('extraction'))return 'Extractions';
 if(t.includes('implant'))return 'Implants';
 if(t.includes('bridge'))return 'Bridges';
 return null;
}
const overviewIds={Crowns:'faq-0',Fillings:'kb-filling-overview','Root canals':'kb-root-canal-overview','Gum care':'kb-gum-care-overview',Extractions:'kb-extraction-overview',Implants:'kb-implant-overview',Bridges:'kb-bridge-overview'};
const visitIds={Crowns:'kb-crown-visit',Fillings:'kb-filling-visit','Root canals':'kb-root-canal-visit','Gum care':'kb-gum-care-visit',Extractions:'kb-extraction-visit',Implants:'kb-implant-visit',Bridges:'kb-bridge-visit'};
const patientReason=c=>String(c.note||'').replace(/^[^:]*:\s*/, '').split(/(?<=\.)\s+/).filter(sentence=>!/^(Follow up|The patient|Patient |The follow-up visit is now)/.test(sentence)).join(' ');
export const missingRationale=c=>!patientReason(c).trim()||/does not include the patient-specific rationale|missing.*rationale/i.test(c.note);
export function relevantKnowledge(c,entries){
 const topic=treatmentTopic(c);
 return entries.filter(e=>e.topic===topic||['General','Scheduling','Cost & Insurance','Communication'].includes(e.topic)||!['Crowns','Fillings','Root canals','Gum care','Extractions','Implants','Bridges'].includes(e.topic));
}
const chartSource=c=>({id:'note',kind:'chart',title:'Patient chart',source:`${c.name||'Example patient'}${c.chartId?` · Chart #${c.chartId}`:''}`,text:c.note||'No clinician note available.'});
const planSource=c=>({id:'plan',kind:'chart',title:'Treatment plan',source:`${c.name||'Example patient'}${c.chartId?` · Chart #${c.chartId}`:''}`,text:`${c.treatment||'Recommended treatment'} · ${c.duration||60} minutes · ${c.provider||'Dr. Lee'}`});
const knowledgeSource=e=>({id:e.id,kind:'knowledge',title:e.question,source:e.source,text:e.answer,requiresDentist:!!e.dentist});
const money=n=>`$${Number(n).toLocaleString('en-US')}`;
export function composeAnswer(c,intent,entries,entryId){
 const topic=treatmentTopic(c),id=intent==='why'?overviewIds[topic]:intent==='visit'?visitIds[topic]:entryId;
 const entry=entries.find(e=>e.id===id);
 const sources=[],parts=[];
 const needsReason=intent==='why'||(intent==='faq'&&entry?.chart);
 if(needsReason){
  sources.push(chartSource(c));
  parts.push(missingRationale(c)?'Your chart does not include the patient-specific reason for this recommendation. I won’t guess why it was recommended.':`Your clinician’s note says: “${patientReason(c)}”`);
 }
 if(intent==='visit'){
  sources.push(planSource(c));
  parts.push(`Your current plan reserves ${c.duration||60} minutes with ${c.provider||'Dr. Lee'} for ${String(c.treatment||'the recommended treatment').toLowerCase()}.`);
 }
 if(entry?.topic==='Cost & Insurance'&&c.billing){
  const b=c.billing,paid=b.payments.reduce((sum,p)=>sum+p.amount,0);
  const text=`Your recorded estimate is ${money(b.fee)} for treatment, with ${money(b.insurance)} expected from ${b.plan}. Your estimated share is ${money(b.share)}; ${money(paid)} is paid and ${money(Math.max(0,b.share-paid))} remains. Insurance coverage is an estimate.`;
  parts.push(text);sources.push({id:'billing',kind:'chart',title:'Insurance & billing',source:c.name||'Example patient',text});
 }
 if(entry){
  sources.push(knowledgeSource(entry));
  parts.push(entry.dentist?'The practice has marked this question for dentist input. I can help arrange a discussion before you decide.':`Our practice guidance: ${entry.answer}`);
 }else{
  parts.push('There is no saved practice answer for this question. I can help arrange a discussion with the dental team.');
 }
 if(needsReason&&missingRationale(c)&&!entry?.dentist)parts.push('I can arrange a discussion with the dentist to clarify your individual recommendation before you decide.');
 return {text:parts.join('\n\n'),sources,entry,requiresDentist:!!entry?.dentist||(needsReason&&missingRationale(c))};
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function responsePassages(message){
 if(message.passages)return message.passages;
 const sources=(message.sources||[]).filter(s=>s&&typeof s==='object');
 if(!sources.length)return null;
 // Earlier saved replies retain their original source snapshots, with presentation-only cleanup.
 const paragraphs=message.text.split(/\n\n/);
 return paragraphs.map(text=>{
  let source;
  if(text.startsWith('Our practice guidance: ')){text=text.slice(23);source=sources.find(s=>s.kind==='knowledge');}
  else if(text.startsWith('Your clinician’s note says: “')){text=text.slice(29).replace(/”$/,'');source=sources.find(s=>s.id==='note');}
  else if(text.startsWith('Your current plan reserves'))source=sources.find(s=>s.id==='plan');
  else if(text.startsWith('Your recorded estimate'))source=sources.find(s=>s.id==='billing');
  return {text,sourceId:source?.id};
 });
}
export function responseMarkup(message,patient){
 const passages=responsePassages(message);
 if(!passages||!passages.some(p=>p.sourceId))return null;
 return passages.map(p=>{
  const source=message.sources.find(s=>s&&typeof s==='object'&&s.id===p.sourceId);
  if(!source)return esc(p.text);
  if(source.kind==='knowledge')return `<a class="source-passage source-knowledge" href="knowledge.html?faq=${encodeURIComponent(source.id)}&patient=${encodeURIComponent(patient.id)}" title="Knowledge: ${esc(source.title)}">${esc(p.text)}</a>`;
  const kind=source.id==='billing'||source.title==='Front desk clarification'?'billing':'charts';
  return `<a class="source-passage source-record" href="#patient-record" data-view-source="${kind}" data-source-id="${esc(patient.id)}" title="${esc(source.title)} · ${esc(patient.name)}">${esc(p.text)}</a>`;
 }).join(' ');
}

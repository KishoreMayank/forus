import {costInsuranceEntries} from './cost-insurance.js?v=2';
import {treatmentTopics,treatmentEntries,visitEntries,chartExamples,treatmentDescriptions} from './treatment-knowledge.js?v=3';
const key='cedar-knowledge-v2';
const oldKey='cedar-practice-faq-v1';
const host=document.querySelector('.faq-list');
const editor=document.querySelector('#faq-editor'),form=editor.querySelector('form'),error=editor.querySelector('[role="alert"]');
const BUILT_IN_TOPICS=[...treatmentTopics,'General','Scheduling','Cost & Insurance','Communication'];
const topics=[...BUILT_IN_TOPICS];
const DELETED_KEY='cedar-knowledge-deleted-v1';
let deletedIds=[];try{const d=JSON.parse(localStorage.getItem(DELETED_KEY));if(Array.isArray(d))deletedIds=d;}catch{}
try{const saved=JSON.parse(localStorage.getItem('cedar-custom-topics-v1'));if(Array.isArray(saved))for(const t of saved)if(typeof t==='string'&&t.trim()&&!topics.includes(t))topics.push(t);}catch{}
const topicMap={'Treatment questions':'General',Appointments:'Scheduling','Follow-up':'Communication',Practice:'Communication'};
const defaults=[...host.querySelectorAll('.faq-item')].map((el,i)=>({id:`faq-${i}`,topic:i<2?'Crowns':i<5?'Appointments':'Follow-up',question:el.querySelector('summary').firstChild.textContent.trim(),answer:el.querySelector('.faq-answer p').textContent,source:el.querySelector('small').textContent.replace(/^Source: /,''),chart:i===0}));
// Patient-facing guidance, kept separate from each patient's recorded rationale.
const crownWhy='Crowns are usually recommended when a tooth is cracked, weakened by a large filling, or has had a root canal. Your dentist can explain how this applies to your tooth before you decide.';
defaults[0].answer=crownWhy;
let entries=defaults;
try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved)&&saved.length&&saved.every(e=>e.id&&(topics.includes(e.topic)||topicMap[e.topic])&&typeof e.question==='string'&&typeof e.answer==='string'&&typeof e.source==='string'))entries=saved;else{const old=JSON.parse(localStorage.getItem(oldKey));if(Array.isArray(old))entries=entries.concat(old.filter(e=>typeof e.question==='string'&&typeof e.answer==='string'&&typeof e.source==='string').map((e,i)=>({...e,id:`custom-${i}`,topic:'Practice'})));}}catch{}

entries=entries.map(e=>({...e,topic:topicMap[e.topic]||e.topic}));
// Expand the starter library once; preserve subsequent practice edits and removals.
if(!localStorage.getItem('cedar-knowledge-organized-v1')){
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
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-knowledge-organized-v1','1');}catch{}
}
const answerUpdates={
 'faq-3':['Can I speak with the dentist before deciding?','Yes. I can help arrange a separate discussion with the dentist so you can ask questions before making a treatment decision.'],
 'faq-4':['How do you choose the right appointment?','I use the visit length and provider listed in your treatment plan, then check available times. Nothing is booked until you confirm your choice.'],
 'faq-5':['What if I need to reschedule or wait?','I can help find another available time or pause scheduling follow-ups until an agreed date. An existing appointment stays in place unless you confirm a change or cancellation.'],
 'faq-6':['What if my chart does not answer my question?','I will explain what information is missing and help arrange a discussion with the dentist. I will not guess why a treatment was recommended or how urgently you need it.']
};
if(!localStorage.getItem('cedar-knowledge-copy-v1')){
 entries=entries.map(e=>answerUpdates[e.id]&&!e.updated?{...e,question:answerUpdates[e.id][0],answer:answerUpdates[e.id][1]}:e);
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-knowledge-copy-v1','1');}catch{}
}
entries=entries.map(e=>({...e,topic:topicMap[e.topic]||e.topic}));
if(!localStorage.getItem('cedar-treatment-library-v1')){
 entries=entries.map(e=>({...e,dentist:e.dentist||['treatment-alternatives','treatment-timing','faq-6'].includes(e.id)}));
 for(const entry of treatmentEntries)if(!entries.some(e=>e.id===entry.id||e.question===entry.question))entries.push(entry);
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-treatment-library-v1','1');}catch{}
}
// Add the billing library once without replacing practice edits.
if(!localStorage.getItem('cedar-cost-insurance-v1')){
 for(const entry of costInsuranceEntries)if(!entries.some(e=>e.id===entry.id))entries.push({...entry});
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-cost-insurance-v1','1');}catch{}
}
// Content refresh v2: fictional practice sources (no outside sites), billing answers that match pay-by-text,
// and patient-voice wording. Entries a staff member edited (updated:true) keep their text.
if(!localStorage.getItem('cedar-knowledge-copy-v2')){
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
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-knowledge-copy-v2','1');}catch{}
}
// Content v3: a General section for treatment-wide questions, tailored "what to expect" answers,
// no duplicate "alternatives" answers. Staff edits (updated:true) and deletions are respected.
if(!localStorage.getItem('cedar-knowledge-v3')){
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
 try{localStorage.setItem(key,JSON.stringify(entries));localStorage.setItem('cedar-knowledge-v3','1');}catch{}
}
const topicDescriptions={...treatmentDescriptions,'Cost & Insurance':'Estimates, coverage, payment options, and understanding your bill.','Scheduling':'Booking, preparing for a visit, and changing an appointment.','Communication':'Who Clara is, contact preferences, and reaching the practice.'};
let topic=entries[0].topic,selected=entries[0].id,editing=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chosen=()=>entries.find(e=>e.id===selected);
host.className='knowledge-workspace';
const topicField=document.createElement('label');topicField.htmlFor='faq-topic';topicField.textContent='Section';
const topicSelect=document.createElement('select');topicSelect.id='faq-topic';topicSelect.name='topic';topicSelect.innerHTML=topics.map(t=>`<option>${esc(t)}</option>`).join('');
form.querySelector('label').before(topicField,topicSelect);
const handling=document.createElement('label');handling.className='faq-handling';handling.innerHTML='<input type="checkbox" name="dentist"> Dentist input required';form.querySelector('.faq-save-note').before(handling);
document.body.classList.add('knowledge-page');
const topicNav=document.createElement('details');topicNav.className='workspace-sections';
const wideSections=window.matchMedia('(min-width:1101px)');topicNav.open=wideSections.matches;wideSections.addEventListener('change',event=>{topicNav.open=event.matches;});
topicNav.addEventListener('click',event=>{const button=event.target.closest('[data-topic],[data-add-section]');if(!button)return;event.stopPropagation();if(!discardDraft())return;if(button.hasAttribute('data-add-section')){openSectionDialog();return;}topic=button.dataset.topic;topicNav.open=wideSections.matches;render();});
const sectionDialog=document.createElement('dialog');sectionDialog.setAttribute('aria-labelledby','section-dialog-title');sectionDialog.innerHTML='<form><h2 id="section-dialog-title">Add section</h2><p>Group related questions under a topic.</p><label for="section-name">Section name</label><input id="section-name" name="name" required maxlength="50" placeholder="e.g. Preparing for your visit"><p class="section-error" role="alert"></p><div class="section-form-actions"><button class="control" type="button" data-close-section>Cancel</button><button class="control" data-primary="true" type="submit">Create section</button></div></form>';document.body.append(sectionDialog);
const sectionForm=sectionDialog.querySelector('form'),sectionError=sectionDialog.querySelector('.section-error');
sectionDialog.querySelector('[data-close-section]').addEventListener('click',()=>sectionDialog.close());
let renaming=null;
function openSectionDialog(name=null){renaming=name;sectionForm.reset();sectionError.textContent='';sectionDialog.querySelector('h2').textContent=name?'Rename section':'Add section';sectionDialog.querySelector('[type="submit"]').textContent=name?'Save name':'Create section';sectionForm.elements.name.value=name||'';sectionDialog.showModal();sectionForm.elements.name.focus();}
function saveCustomTopics(){localStorage.setItem('cedar-custom-topics-v1',JSON.stringify(topics.filter(t=>!BUILT_IN_TOPICS.includes(t))));}
function saveEntries(next){localStorage.setItem(key,JSON.stringify(next));entries=next;}
sectionForm.addEventListener('submit',event=>{
 event.preventDefault();const name=sectionForm.elements.name.value.trim();
 if(!name){sectionError.textContent='Enter a section name.';return;}
 if(topics.some(t=>t.toLowerCase()===name.toLowerCase()&&t!==renaming)){sectionError.textContent='A section with this name already exists.';return;}
 const old=renaming,nextTopics=old?topics.map(t=>t===old?name:t):[...topics,name];
 try{
  const prev=[...topics];topics.splice(0,topics.length,...nextTopics);saveCustomTopics();
  if(old)try{saveEntries(entries.map(e=>e.topic===old?{...e,topic:name}:e));}catch(err){topics.splice(0,topics.length,...prev);saveCustomTopics();throw err;}
 }catch{sectionError.textContent='Could not save this section. Please try again.';return;}
 topic=name;if(!old)selected=null;topicSelect.innerHTML=topics.map(t=>`<option>${esc(t)}</option>`).join('');sectionDialog.close();render();
 document.querySelector('#faq-status').textContent=old?`Section renamed to ${name}.`:`Section ${name} created.`;
 (old?host.querySelector('[data-rename-section]'):host.querySelector('[data-add-faq]'))?.focus();
});
function deleteSection(name){
 if(BUILT_IN_TOPICS.includes(name))return;
 const count=entries.filter(e=>e.topic===name).length;
 if(!window.confirm(count?`Delete the ${name} section? Its ${count} ${count===1?'FAQ moves':'FAQs move'} to General.`:`Delete the ${name} section?`))return;
 try{saveEntries(entries.map(e=>e.topic===name?{...e,topic:'General'}:e));topics.splice(topics.indexOf(name),1);saveCustomTopics();}catch{document.querySelector('#faq-status').textContent='Could not delete this section. Please try again.';return;}
 topic=count?'General':topics[0];selected=null;topicSelect.innerHTML=topics.map(t=>`<option>${esc(t)}</option>`).join('');render();
 document.querySelector('#faq-status').textContent=`Section ${name} deleted.`;
}
function deleteFaq(id){
 const e=entries.find(x=>x.id===id);if(!e)return;
 if(!window.confirm(`Delete “${e.question}”? Clara will no longer have this answer.`))return;
 try{saveEntries(entries.filter(x=>x.id!==id));deletedIds=[...new Set([...deletedIds,id])];localStorage.setItem(DELETED_KEY,JSON.stringify(deletedIds));}catch{document.querySelector('.edit-error').textContent='Could not delete in this browser. Please try again.';return;}
 draftId=null;topicDrafts=[];selected=null;render();
 document.querySelector('#faq-status').textContent='FAQ deleted.';host.querySelector('[data-add-faq]')?.focus();
}
function render(){
 const visible=entries.filter(e=>e.topic===topic);
 topicNav.innerHTML=`<summary>Sections <span>${esc(topic)}</span><span class="picker-chevron" aria-hidden="true"></span></summary><div class="section-items"><h2>Sections</h2><div class="section-links">${topics.map(t=>`<button type="button" data-topic="${esc(t)}" aria-pressed="${t===topic}"><span>${esc(t)}</span><small>${entries.filter(e=>e.topic===t).length}</small></button>`).join('')}</div><button type="button" class="add-section" data-add-section>+ Add section</button></div>`;
 if(!visible.some(e=>e.id===selected))selected=visible[0]?.id;
 host.innerHTML=`<section class="knowledge-articles" aria-label="FAQ articles"><div class="knowledge-section-title topic-heading"><h2 class="desktop-topic-title">${esc(topic)}</h2><div class="topic-actions"><span>${visible.length} ${visible.length===1?'answer':'answers'}</span>${BUILT_IN_TOPICS.includes(topic)?'':'<button type="button" class="section-action" data-rename-section>Rename</button><button type="button" class="section-action danger" data-delete-section>Delete section</button>'}</div></div><p class="topic-description">${esc(topicDescriptions[topic]||'Practice answers for this topic.')}</p>${!visible.length?'<div class="empty-section"><strong>Add your first answer</strong><p>Start with a question patients ask about this topic.</p></div>':''}${visible.map(e=>`<details class="knowledge-article ${e.id===selected?'selected':''}" data-faq="${esc(e.id)}" ${e.id===selected?'open':''}><summary class="question-select">${esc(e.question)}<span class="faq-chevron" aria-hidden="true"></span></summary><p>${esc(e.answer)}</p>${e.dentist?'<span class="dentist-badge">Dentist input required</span>':''}<div class="faq-entry-actions"><button type="button" class="article-edit" data-edit-faq="${esc(e.id)}">Edit answer</button></div></details>`).join('')}<button type="button" class="add-topic-faq" data-add-faq>+ Add FAQ</button></section><aside class="knowledge-preview" aria-label="How patients see it"><div class="knowledge-section-title"><h2>How patients see it</h2><span>Preview only</span></div><div id="response-preview"></div><p class="preview-disclaimer">Illustrative preview using saved guidance. No message is sent.</p></aside>`;
 host.prepend(topicNav);
 renderPreview();
}
function renderPreview(draft){
 const e=draft||chosen();
 if(!e){document.querySelector('#response-preview').innerHTML='<div class="empty-preview">Add an FAQ to see how Clara could answer a patient.</div>';return;}
 const chart=e.chart&&/^why\b/i.test(e.question)?(chartExamples[e.topic]||''):'';
 document.querySelector('#response-preview').innerHTML=`<div class="message-history preview-transcript" aria-label="Example conversation"><article class="chat-message patient"><div class="chat-who">Patient</div><p>${esc(e.question)}</p></article><article class="chat-message assistant"><div class="chat-who">Clara · AI assistant</div><p class="show-sources">${chart?`<span class="from-chart">${esc(chart)}</span> `:''}<span class="from-guidance">${esc(e.answer)}</span></p><details class="message-source"><summary>Sources used</summary>${chart?`<p><strong>Patient chart · example</strong><br>${esc(chart)}</p>`:''}<p><strong>Practice guidance</strong><br>${esc(e.source)}</p></details></article></div><div class="preview-legend">${chart?'<span><i class="chart-key"></i>From the chart</span>':''}<span><i class="guidance-key"></i>Practice answer</span></div>${e.dentist?'<div class="preview-routing">Dentist input required · Clara offers a discussion</div>':''}`;
}
function openEditor(id=null){editing=id;const e=entries.find(x=>x.id===id);form.reset();error.textContent='';document.querySelector('#faq-editor-title').textContent=e?'Edit FAQ':'Add FAQ';for(const name of ['question','answer','source'])form.elements[name].value=e?.[name]||'';form.elements.topic.value=e?.topic||topic;form.elements.dentist.checked=!!e?.dentist;editor.showModal();form.elements.question.focus();}
host.addEventListener('click',event=>{if(event.target.closest('[data-add-faq]')){if(!discardDraft())return;openEditor();return;}const editAnswer=event.target.closest('[data-edit-faq]');if(editAnswer){editTopic(editAnswer.dataset.editFaq);return;}if(event.target.closest('[data-save-topic]')){saveTopic();return;}if(event.target.closest('[data-delete-faq]')){deleteFaq(draftId);return;}if(event.target.closest('[data-rename-section]')){openSectionDialog(topic);return;}if(event.target.closest('[data-delete-section]')){deleteSection(topic);return;}if(event.target.closest('[data-cancel-topic]')){render();return;}const t=event.target.closest('[data-topic],[data-preview],[data-edit]');if(!t)return;if(t.dataset.topic){topic=t.dataset.topic;render();}else if(t.dataset.edit)openEditor(t.dataset.edit);else{selected=t.dataset.preview;render();host.querySelector(`.question-select[data-preview="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});}});


host.addEventListener('click',event=>{
 const summary=event.target.closest('details[data-faq] > summary');if(!summary)return;
 event.preventDefault();const item=summary.parentElement;const opening=!item.open;
 if(item.classList.contains('is-editing'))return;
 for(const other of host.querySelectorAll('details[data-faq]:not(.is-editing)')){other.open=false;other.classList.remove('selected');}
 if(opening){item.open=true;item.classList.add('selected');selected=item.dataset.faq;if(!host.querySelector('.inline-faq-editor'))renderPreview();}
});
document.querySelector('#cancel-faq').addEventListener('click',()=>editor.close());
form.addEventListener('submit',event=>{
 event.preventDefault();const entry=Object.fromEntries(['question','answer','source','topic'].map(n=>[n,form.elements[n].value.trim()]));
 if(Object.values(entry).some(v=>!v)){error.textContent='Enter a question, answer, and source.';return;}
 if(entries.some(e=>e.id!==editing&&e.question.toLowerCase()===entry.question.toLowerCase())){error.textContent='That question already exists.';return;}
 const old=entries.find(e=>e.id===editing);Object.assign(entry,{id:editing||(crypto.randomUUID?.()||`faq-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),chart:old?.chart||false,dentist:form.elements.dentist.checked,updated:true});
 const next=editing?entries.map(e=>e.id===editing?entry:e):[...entries,entry];
 try{localStorage.setItem(key,JSON.stringify(next));}catch{error.textContent='Could not save in this browser. Your draft is still here.';return;}
 entries=next;topic=entry.topic;selected=entry.id;editor.close();render();document.querySelector('#faq-status').textContent='FAQ saved. Response preview updated.';
});
render();

let topicDrafts=[],draftId=null;
// Unsaved inline edits: ask before anything redraws the page, and before leaving it.
function hasUnsavedDraft(){const d=topicDrafts.find(e=>e.id===draftId),saved=entries.find(e=>e.id===draftId);return !!(document.querySelector('.inline-faq-editor')&&d&&saved&&(d.question!==saved.question||d.answer!==saved.answer));}
function discardDraft(){if(!hasUnsavedDraft())return true;if(!window.confirm('Discard your unsaved changes to this answer?'))return false;draftId=null;topicDrafts=[];return true;}
window.addEventListener('beforeunload',event=>{if(hasUnsavedDraft()){event.preventDefault();event.returnValue='';}});
function editTopic(id){
 if(document.querySelector('.inline-faq-editor')&&draftId!==id){document.querySelector('#edit-answer').focus();return;}
 topicDrafts=entries.filter(e=>e.id===id).map(e=>({...e}));
 draftId=id;
 renderTopicEditor();
 document.querySelector('#edit-answer').focus({preventScroll:true});
}
function renderTopicEditor(){
 const draft=topicDrafts.find(e=>e.id===draftId);
 const item=host.querySelector(`[data-faq="${CSS.escape(draftId)}"]`);
 item.classList.add('is-editing');item.open=true;
 const summary=item.querySelector('summary').outerHTML;
 item.innerHTML=summary+`<div class="plain-faq-editor inline-faq-editor"><div class="edit-fields"><label for="edit-question">Patient question</label><input id="edit-question" maxlength="200" value="${esc(draft.question)}"><label for="edit-answer">Practice answer</label><p class="field-help" id="answer-help">Write the answer you would give a patient.</p><textarea id="edit-answer" rows="7" maxlength="4000" aria-describedby="answer-help">${esc(draft.answer)}</textarea></div><p class="edit-error" role="alert"></p><div class="plain-edit-actions"><button type="button" class="control danger-quiet" data-delete-faq>Delete FAQ</button><button class="control" data-cancel-topic>Cancel</button><button class="control" data-primary="true" data-save-topic>Save answer</button></div></div>`;
 for(const [id,field] of [['edit-question','question'],['edit-answer','answer']])document.getElementById(id).addEventListener('input',event=>{
  draft[field]=field==='dentist'?event.target.checked:event.target.value;
  renderPreview(draft);
 });
 renderPreview(draft);
 document.querySelector('.knowledge-preview .knowledge-section-title>span').textContent='Unsaved preview';
 document.querySelector('.preview-disclaimer').textContent='Preview updates as you type. Save to keep this answer.';
}
function saveTopic(){
 const nextTopic=topicDrafts.map(e=>({...e,question:e.question.trim(),answer:e.answer.trim(),source:e.source.trim(),updated:true}));
 const other=entries.filter(e=>e.id!==draftId),seen=new Set(other.map(e=>e.question.toLowerCase()));
 for(const e of nextTopic){
  let message='';
  if(!e.question||!e.answer)message='Add a question and practice answer before saving.';
  else if(seen.has(e.question.toLowerCase()))message='This question already exists. Give each question a different name.';
  if(message){draftId=e.id;renderTopicEditor();document.querySelector('.edit-error').textContent=message;return;}
  seen.add(e.question.toLowerCase());
 }
 const next=entries.map(e=>nextTopic.find(d=>d.id===e.id)||e);
 try{localStorage.setItem(key,JSON.stringify(next));}catch{document.querySelector('.edit-error').textContent='Could not save in this browser. Your changes are still here.';return;}
 entries=next;selected=draftId;render();document.querySelector('#faq-status').textContent='Answer saved. The preview shows how Clara would use it.';
}



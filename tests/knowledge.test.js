import test from 'node:test';
import assert from 'node:assert/strict';
import {loadKnowledge,key,DELETED_KEY} from '../public/knowledge-store.js';
import {composeAnswer} from '../public/knowledge-response.js';
import {seed,act,slots} from '../public/engine.js';
import {extendPatients} from '../public/demo-patients.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const last=c=>c.messages.at(-1);

test('saved knowledge edits feed new replies while old messages retain evidence',()=>{
 const storage=memory(),s=seed(),c=s.cases[0];
 let entries=loadKnowledge(storage).entries;
 const original=entries.find(e=>e.id==='faq-0').answer;
 act(s,c.id,'why',null,{knowledge:entries});
 const sent=structuredClone(last(c));
 const edited=entries.map(e=>e.id==='faq-0'?{...e,answer:'You may bring written questions to discuss before deciding.',updated:true}:e);
 storage.setItem(key,JSON.stringify(edited));entries=loadKnowledge(storage).entries;
 act(s,c.id,'faq','faq-0',{knowledge:entries});
 assert.match(last(c).text,/bring written questions/);
 assert.match(last(c).text,/Tooth 30 has a recorded crack/);
 assert.deepEqual(last(c).sources.map(s=>s.kind),['chart','knowledge']);
 assert.equal(last(c).sources[1].text,edited.find(e=>e.id==='faq-0').answer);
 assert.equal(sent.sources[1].text,original);
 assert.deepEqual(c.messages.find(m=>m.id===sent.id),sent);
 c.note='Dr. Shah · Oct 14: Tooth 12 has a different recorded reason.';
 assert.equal(sent.sources[0].text.includes('Tooth 30'),true);
 act(s,c.id,'faq','faq-0',{knowledge:entries});
 assert.match(last(c).text,/Tooth 12/);
 assert.doesNotMatch(last(c).text,/Tooth 30/);
});

test('deletions and an intentionally empty library never restore deleted guidance',()=>{
 const storage=memory();let entries=loadKnowledge(storage).entries;
 storage.setItem(key,JSON.stringify(entries.filter(e=>e.id!=='faq-0')));
 storage.setItem(DELETED_KEY,JSON.stringify(['faq-0']));
 entries=loadKnowledge(storage).entries;assert.ok(!entries.some(e=>e.id==='faq-0'));
 const s=seed(),c=s.cases[0],wake=c.wakeAt,count=c.messages.length;
 assert.equal(act(s,c.id,'faq','faq-0',{knowledge:entries}).ok,false);
 assert.equal(c.messages.length,count);assert.equal(c.wakeAt,wake);
 act(s,c.id,'why',null,{knowledge:entries});
 assert.match(last(c).text,/no saved practice answer/);
 assert.deepEqual(last(c).sources.map(s=>s.kind),['chart']);
 storage.setItem(key,'[]');assert.deepEqual(loadKnowledge(storage).entries,[]);
});

test('new practice FAQs are usable and clinical flags route without inventing advice',()=>{
 const storage=memory(),s=seed(),c=s.cases[0];let entries=loadKnowledge(storage).entries;
 entries.push({id:'custom-question',topic:'General',question:'Can I bring my questions?',answer:'Bring a written list.',source:'Practice guidance',dentist:false});
 storage.setItem(key,JSON.stringify(entries));entries=loadKnowledge(storage).entries;
 act(s,c.id,'faq','custom-question',{knowledge:entries});assert.match(last(c).text,/Bring a written list/);assert.equal(c.status,'engaged');assert.equal(c.wakeAt,null);
 entries=entries.map(e=>e.id==='custom-question'?{...e,dentist:true,answer:'An unreviewed individual clinical opinion.'}:e);
 act(s,c.id,'faq','custom-question',{knowledge:entries});
 assert.match(last(c).text,/dentist input/);assert.doesNotMatch(last(c).text,/unreviewed individual clinical opinion/);
 assert.equal(last(c).sources[0].requiresDentist,true);
 assert.equal(c.events.at(-1).title,'Dentist discussion offered');
});

test('treatment explanations and visit answers use the right patient and library entries',()=>{
 const entries=loadKnowledge(memory()).entries,s=extendPatients(seed()),c=s.cases.find(c=>c.id==='priya');
 act(s,c.id,'why',null,{knowledge:entries});
 assert.match(last(c).text,/tooth 14/i);assert.match(last(c).text,/filling/i);assert.doesNotMatch(last(c).text,/crown/i);assert.doesNotMatch(last(c).text,/Follow up to schedule/);assert.match(last(c).sources[0].text,/Follow up to schedule/);
 act(s,c.id,'visit',null,{knowledge:entries});
 assert.match(last(c).text,new RegExp(`${c.duration} minutes`));
 assert.equal(last(c).sources.find(s=>s.kind==='knowledge').id,'kb-filling-visit');
 assert.deepEqual(last(c).sources.map(s=>s.kind),['chart','knowledge']);
});

test('practice guidance cannot fill a missing clinical rationale',()=>{
 const s=seed(),c=s.cases.find(c=>c.id==='alex'),entries=loadKnowledge(memory()).entries;
 const response=composeAnswer(c,'why',entries);
 assert.equal(response.requiresDentist,true);assert.match(response.text,/won’t guess/);
 assert.doesNotMatch(response.text,/Your clinician’s note says/);
 assert.ok(response.sources.some(s=>s.kind==='knowledge'));
});

test('questions preserve booking and pause; billing answers use patient amounts',()=>{
 const s=seed(),c=s.cases[0],entries=loadKnowledge(memory()).entries;
 act(s,c.id,'pause');const wake=c.wakeAt;
 act(s,c.id,'faq','faq-0',{knowledge:entries});assert.equal(c.wakeAt,wake);assert.equal(c.status,'paused');
 act(s,c.id,'slots');act(s,c.id,'book',slots(s,c)[0].id);const appt=structuredClone(c.appointment);
 const billing=entries.find(e=>e.topic==='Cost & Insurance');
 act(s,c.id,'faq',billing.id,{knowledge:entries});
 assert.match(last(c).text,/\$500/);assert.deepEqual(c.appointment,appt);assert.equal(c.stage,'booked');
 assert.deepEqual(last(c).sources.map(s=>s.kind),['chart','knowledge']);
 act(s,c.id,'stop');const n=c.messages.length;assert.equal(act(s,c.id,'faq',billing.id,{knowledge:entries}).ok,false);assert.equal(c.messages.length,n);
});

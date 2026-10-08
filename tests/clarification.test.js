import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,act} from '../public/engine.js';
import {extendPatients} from '../public/demo-patients.js';

test('clinical resolution requires manually entered text and keeps it with the reply',()=>{
 const s=seed(),c=s.cases.find(c=>c.id==='alex'),before=JSON.stringify(c);
 assert.equal(act(s,c.id,'resolve').ok,false);
 assert.equal(act(s,c.id,'resolve',{note:'  ',author:'Dr. Lee'}).ok,false);
 assert.equal(JSON.stringify(c),before);
 const note='The recorded crack in tooth 30 is why I recommended a crown. We can discuss the plan before you decide.';
 assert.equal(act(s,c.id,'resolve',{author:'Dr. Lee',note}).ok,true);
 assert.ok(c.note.endsWith(note));assert.equal(c.clarifications[0].note,note);
 assert.ok(c.messages.at(-1).text.includes(note));
 assert.equal(c.messages.at(-1).sources[0].text,c.note);
 assert.equal(c.stage,'explained');assert.equal(c.status,'engaged');
 assert.equal(c.events.at(-1).detail,`Dr. Lee: ${note}`);
 const persisted=JSON.parse(JSON.stringify(s)).cases.find(c=>c.id==='alex');
 assert.equal(persisted.clarifications[0].note,note);
 const count=c.messages.length;assert.equal(act(s,c.id,'resolve',{author:'Dr. Lee',note}).ok,false);assert.equal(c.messages.length,count);
});

test('front desk clarification preserves clinical notes and estimated amounts',()=>{
 const s=extendPatients(seed()),c=s.cases.find(c=>c.id==='ella-cost');
 const chart=c.note,share=c.billing.share,note='We reviewed the benefits on file. The estimate may change after the insurer processes the claim.';
 assert.ok(act(s,c.id,'resolve',{author:'Jamie · Front desk',note}).ok);
 assert.equal(c.note,chart);assert.equal(c.billing.share,share);assert.equal(c.attention,null);
 assert.equal(c.billing.clarification.note,note);assert.equal(c.clarifications[0].author,'Jamie · Front desk');
 assert.ok(c.messages.at(-1).text.includes(note));assert.ok(c.messages.at(-1).text.includes('$550'));
 assert.equal(c.messages.at(-1).sources[0].text,note);
});

test('saving a clinical reason respects a stop request',()=>{
 const s=seed(),c=s.cases.find(c=>c.id==='alex');act(s,c.id,'stop');const n=c.messages.length;
 assert.ok(act(s,c.id,'resolve',{author:'Dr. Lee',note:'A crack is recorded in tooth 30.'}).ok);
 assert.equal(c.messages.length,n);assert.equal(c.contact,false);assert.equal(c.stage,'done');assert.equal(c.wakeAt,null);
});

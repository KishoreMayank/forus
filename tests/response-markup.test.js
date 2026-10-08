import test from 'node:test';
import assert from 'node:assert/strict';
import {responsePassages,responseMarkup} from '../public/response-markup.js';
import {composeAnswer} from '../public/knowledge-response.js';
import {loadKnowledge} from '../public/knowledge-store.js';
import {seed} from '../public/engine.js';
test('each passage links to its own source and escapes editable text',()=>{
 const c=seed().cases[0],r=composeAnswer(c,'why',loadKnowledge().entries),html=responseMarkup(r,c);
 assert.equal(r.passages[0].sourceId,'note');assert.equal(r.passages[1].sourceId,'faq-0');
 assert.ok(!r.text.includes('Our practice guidance:'));assert.ok(!r.text.includes('\n'));
 assert.match(html,/data-source-id="maya"/);assert.match(html,/knowledge.html\?faq=faq-0&patient=maya/);
 r.passages[1].text='<script>bad</script>';assert.ok(!responseMarkup(r,c).includes('<script>'));
});
test('earlier source-backed replies get clean paragraphs without changing saved text',()=>{
 const m={text:'Your clinician’s note says: “A recorded crack.”\n\nOur practice guidance: A crown supports the tooth.',sources:[{id:'note',kind:'chart'},{id:'faq-0',kind:'knowledge'}]};
 assert.deepEqual(responsePassages(m),[{text:'A recorded crack.',sourceId:'note'},{text:'A crown supports the tooth.',sourceId:'faq-0'}]);assert.ok(m.text.startsWith('Your clinician'));
});

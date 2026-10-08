# Cedar — Patient follow-up workspace

The main app lives in `public/` and opens at the site root. It uses plain HTML, CSS, and JavaScript with fictional patient records and scripted conversations. Changes are stored in each browser; there is no live messaging, AI backend, or practice-system integration.

## Run locally

```sh
npm start
```

Open **http://localhost:4173/**. `npm run dev` starts the same server. Requires Python 3; no installation or build step is needed. If port 4173 is busy, run `python3 -m http.server 4174 --directory public` and open http://localhost:4174/.

## Verify

```sh
npm test
```

Requires Node.js 20+. The workflow tests cover scheduling, pauses, completion, contact preferences, duplicate booking protection, payments, and the connection between saved knowledge and patient responses.

## Files

- `public/index.html`: Patients, the main entry point.
- `public/knowledge.html`: practice FAQs with a preview that uses the same response composer and patient records as conversations. Saved edits affect new replies in this browser.
- `public/integrations.html`: integration overview and source viewers.
- `public/knowledge-store.js`: shared library initialization, migrations, saved edits, and deletion handling.
- `public/knowledge-response.js`: deterministic composition of practice guidance with the relevant patient chart, treatment plan, or billing record; source text is captured with each new reply.
- `public/engine.js`: shared demo state and workflow logic. Includes fictional insurance estimates and the `pay` action: after a treatment visit is booked, Clara texts the estimated share and the patient replies to pay with the card on file or to pay at the visit. Staff see the status on the patient, a Paid tag in the list, and payments under Integrations → Insurance & billing. No card is charged.
- Other files in `public/`: styles, page logic, calendar, sample records, and reminder previews.
- `tests/`: workflow tests.
- `vercel.json`: static hosting configuration. Only `public/` is served.

## Deployment

Production: https://forus-lemon.vercel.app/

Pushes to `main` deploy automatically through Vercel.

## Demonstrate the Knowledge connection

1. Open Knowledge and edit “Why was a crown recommended?” Save a distinctive, appropriate sentence.
2. Reset the sample workflow, open Maya’s Communication tab, and select “Why was this recommended?”
3. The next reply combines Maya’s recorded recommendation with the saved practice answer. “Sources used” shows both records.
4. Change the FAQ again and start a fresh sample conversation. New replies use the new text; existing replies retain their original source snapshots.
5. A filling patient uses filling guidance. Deleted FAQs are not reused, and a missing clinical rationale leads to a dentist discussion rather than a guessed reason.

Responses are composed deterministically from selected questions; this is not a live language model or free-text retrieval system. Transactional confirmations use current booking/payment state. General practice questions use saved guidance, with patient records added when relevant. Knowledge changes do not rewrite prior messages. Existing messages created before this wiring retain legacy source references.

## Manual intervention

On Alex’s Needs attention card, choose **Add clinical reason**. On Ella’s card, choose **Add clarification**. Enter the author and a patient-facing explanation, then **Save and share with patient**. The demo saves the note, records its author and time, clears the review flag, and composes Clara’s reply from that clarification. Clinical reasons update the chart; front-desk notes stay with billing and leave clinical notes and estimate amounts unchanged. Empty submissions are rejected. Stopped contact is respected.

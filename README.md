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

Requires Node.js 20+. The workflow tests cover scheduling, pauses, completion, contact preferences, duplicate booking protection, and payments.

## Files

- `public/index.html`: Patients, the main entry point.
- `public/knowledge.html`: practice FAQs with a live preview of how Clara would answer. Edits are saved in this browser; Clara’s scripted demo replies don’t change.
- `public/integrations.html`: integration overview and source viewers.
- `public/engine.js`: shared demo state and workflow logic. Includes fictional insurance estimates and the `pay` action: after a treatment visit is booked, Clara texts the estimated share and the patient replies to pay with the card on file or to pay at the visit. Staff see the status on the patient, a Paid tag in the list, and payments under Integrations → Insurance & billing. No card is charged.
- Other files in `public/`: styles, page logic, calendar, sample records, and reminder previews.
- `tests/`: workflow tests.
- `vercel.json`: static hosting configuration. Only `public/` is served.

## Deployment

Production: https://forus-lemon.vercel.app/

Pushes to `main` deploy automatically through Vercel.

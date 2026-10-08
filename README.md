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
- `public/knowledge.html`: practice knowledge and answer editing.
- `public/integrations.html`: integration overview and source viewers.
- `public/engine.js`: shared demo state and workflow logic. Includes fictional insurance estimates and the `pay` action: after a treatment visit is booked, Clara texts the estimated share and the patient replies to pay with the card on file or to pay at the visit. Staff see the status on the patient, a Paid tag in the list, and payments under Integrations → Insurance & billing. No card is charged.
- Other files in `public/`: styles, page logic, calendar, sample records, and reminder previews.
- `tests/`: workflow tests.
- `vercel.json`: static hosting configuration. Only `public/` is served.

## Deployment

Production: https://forus-lemon.vercel.app/

Pushes to `main` deploy automatically through Vercel. Older `/redesigns/` links redirect to the current pages in production.

## Previous version

`reference/previous-app-2026-10-08/` preserves the prior React/Vite app, its source, README, package files, and configuration. It is excluded from deployment. Its README documents how to run it. The obsolete Codex prototype and layout studies were removed from the active tree and remain recoverable in Git history.

## Booked and paid demo

1. Select an **In progress** patient with no appointment, such as Maya Chen, and open **Communication**.
2. Choose **Why was this recommended?** to show the chart-grounded explanation and its sources.
3. Choose **Find a time**, select an available slot, then **Confirm appointment**. The patient moves to **Booked** and the calendar receives the appointment.
4. Choose **Take payment** on the appointment card. Review the patient share and payment method, then confirm the simulated charge. No real card is charged.
5. Show the **Paid** badge, receipt and zero balance on the appointment card, and the receipt message in the conversation. **Patient info → Recent activity** records the payment; treatment remains incomplete.
6. Open **Integrations → Insurance & billing → View payments** to show the same receipt in the ledger. Refresh retains the booking and payment in this browser.

Maya's fictional patient share is $500, separate from the $750 insurance estimate. Payment is a staff-triggered demo action; Clara does not autonomously charge a patient or send a real payment link.

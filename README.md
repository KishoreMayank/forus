# Harbor Dental · Follow-up

A working demo of a coordinator that follows up, on its own, with patients who were recommended treatment but haven't booked it. It texts or emails them, explains the recommendation from their chart and the practice's FAQs, books and rebooks appointments, and remembers pauses. It hands clinical and cost questions to people, and closes the case only when treatment history shows the work is done.

**No AI is used.** Replies are scripted, patients are fictional, and the practice systems (charts, treatment history, scheduling, texting, email) are simulated in the browser. A deterministic engine drives everything, and the sample practice's history is played through that same engine.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # engine rules
npm run build
```

## The product

**Patients**

The list shows 11 patients found in charts, grouped as **Needs attention**, **In progress** and **Booked**, with Closed collapsed at the bottom. You can search, and filter with chips that show a count for each group. Each row shows the treatment and dentist, a status in plain words, and who it's waiting on when a person is needed.

Clicking a patient opens a side panel that pushes the list over. It has two tabs:

- **Patient**
  - what the chart says, quoted with its source
  - the state of each connected system for this patient
  - contact details and best time
  - recent activity
  - the next step
- **Conversation**
  - the text or email thread, as the patient sees it
  - **Show sources**, which tints each sentence by where it came from: green for the chart, blue for an FAQ
  - the next message at the end, as a draft with *Send now* and *Pause*. It's produced by the engine itself, so it's exactly what will be sent.
  - for front-desk hand-offs, a hold with *Mark as called* instead of a draft

**Knowledge**

The FAQ files are markdown, one per treatment, plus `the-appointment.md`, `scheduling.md` and a draft `costs.md`. Each question shows how often it has been used in replies. A line starting `→ Ask the dentist` or `→ Front desk` is a rule: the coordinator hands the question off instead of answering it. *Preview with a chart* shows the exact reply a real patient would get to the selected question, combining their chart with the file.

**Integrations**

There's one tile per connected system: Patient charts, Treatment history, Scheduling, Text messages and Email. Each tile shows a live number. Opening a tile shows what it reads, what it writes, and its recent activity. Scheduling opens the **appointment book**, a week view where bookings made through follow-up are highlighted; click one to open that patient.

## Demo controls

The dark bar at the top is for reviewers, not staff. It has:

- the simulated clock
- **+1 day**
- **Skip to [patient]'s next step**
- **Simulate cancellation**
- **Record completion**
- **Reset**

Patient replies are chosen under **Try a patient response** in each conversation.

### Walkthrough (about 4 minutes)

1. **Maya** (crown) has asked why and how long a crown lasts, and is choosing a time.
   1. Pick a time.
   2. Click **Simulate cancellation**.
   3. Choose **Check back next week**.
   4. Click **Skip to Maya's next step**. The coordinator remembers the pause and offers fresh times.
   5. Pick one.
   6. Skip twice: the reminder goes out, then the visit passes.
   7. Click **Record completion**. Maya moves to Closed.
2. **Omar** asked about cost, so he's on hold for the front desk and nothing goes out. Click **Mark as called** to resume follow-up.
3. **Elena** asked whether a filling could work instead. Her chart doesn't say, so a call with Dr. Bell was booked. Skip to her next step to see Dr. Bell's note and her decision.
4. **Daniel** is choosing an afternoon. Pick one to book.
5. **Leo** prefers email. His first email is drafted in his conversation.

## Rules the engine enforces

- **First message:** sent automatically. Unanswered outreach stops after the first message plus 2 follow-ups.
- **Pauses:** a requested pause, by the patient or by staff, blocks every message until the check-back. Records are rechecked before resuming.
- **Bookings:** an existing booking suppresses scheduling messages. A practice cancellation reopens the case, and that dentist's day is removed from future offers.
- **Hand-offs:** clinical questions the chart doesn't answer go to the dentist. Cost questions go to the front desk, with no outreach until they're resolved.
- **Completion:** only treatment history confirms it. Attending the visit isn't enough.
- **Opting out:** declining and STOP end all outreach.
- **No duplicates:** every message and wake-up has an idempotency key. Replays and double taps never send or book twice.

The engine is in `src/domain/engine.ts`, the seeded history in `src/domain/init.ts`, and the list and panel's view model in `src/domain/view.ts`. The tests are in `src/domain/engine.test.ts`. Progress is saved in the browser, and Reset restores the sample practice.

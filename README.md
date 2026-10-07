# Treatment Follow-Up · MVP demo

A clickable demo of a coordinator that follows up with patients who left with a recommended treatment but never booked it. It runs on its own, without staff approving each step.

It is **text only, with no AI and no backend**. Replies are scripted, the patients are fictional, and the practice schedule and records are simulated in the browser.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # rule tests
```

## The screen

- **Left:** the three sample patients, each with status and next step, plus counts of active, booked and completed cases.
- **Right:** the selected patient.
  - **Next step**, **appointment**, and **what's holding them back** (scheduling, or understanding the treatment).
  - **Why the dentist recommended it:** the clinician's note from the chart. This is the only source used for patient-specific reasons.
  - **Conversation:** the texts exchanged, with short notes between them explaining what the coordinator did and why. Explanations list their sources.
  - **Choose the patient's reply:** a demo stand-in for the patient texting back.
- **Knowledge library tab:** three practice-written entries that the coordinator uses for general explanations.
- **Demo controls** (the yellow bar, not part of the product): clock, +1 day, Skip to the patient's next step, Simulate cancellation, Record completion, Reset.

## Try it (about 3 minutes)

**Maya**
1. Her first text has already gone out automatically.
2. Pick **Why do I need a crown?** The reply quotes Dr. Shah's note and separately gives general crown information.
3. Pick **Yes, let's find a time**, then pick a slot. Her status becomes Booked.
4. Click **Simulate cancellation**. The dentist is out that day, so the coordinator offers new times.
5. Pick **Check back next week**. The case shows Paused, and the pending follow-up is cancelled.
6. Click **Skip to Maya's next step**. A week passes, the coordinator remembers the pause, checks again, and offers new times.
7. Pick a slot. Skip ahead twice: you'll see a reminder, then *Awaiting completion*. Attending a visit does not count as completion.
8. Click **Record completion**. The case closes and follow-up stops.

**Daniel:** pick **I'm ready to schedule**, then a time. He gets booked directly.

**Elena**
1. Pick **Why do I need a crown?**, then **Could a filling work instead?** Her record doesn't answer that, so the coordinator says so.
2. It offers a discussion with Dr. Bell and passes her question to the dental team.
3. Book the discussion, then skip ahead. Elena then decides whether to go ahead. The crown stays unbooked until she does.

## Rules the coordinator follows

- The first outreach is automatic. Unanswered outreach stops after the first message and 2 follow-ups.
- A requested pause blocks all messages until the date the patient asked for. An existing booking blocks scheduling nudges.
- A cancellation reopens the case unless the patient paused or stopped messages.
- Completion comes only from the practice record, never from attendance alone.
- Declining and STOP end all outreach.
- Each scheduled step has a unique key, so processing an event twice never sends a duplicate message or makes a double booking.
- Explanations come only from the clinician's note and the knowledge library. Anything those don't cover goes to the dentist; the coordinator doesn't guess.

The rules live in `src/domain/engine.ts` and are tested in `src/domain/engine.test.ts`. Progress is saved in the browser, so it survives a refresh, and Reset restores the sample data.

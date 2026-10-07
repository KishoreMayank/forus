# Treatment Follow-Up · MVP demo

An interactive, text-only proof of concept of a coordinator that helps patients follow through on dental treatment their dentist already recommended. The coordinator finds out what is holding the patient back, explains the recommendation using only what the practice has on record, books and rebooks appointments, remembers when a patient asks for a pause, and tracks the case until the practice record shows the treatment is complete.

**No AI is used.** Every reply is scripted, every transition is deterministic, all records are fictional, and the practice integrations (schedule, chart, texting) are simulated in the browser.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # engine rule tests (vitest)
npm run build   # type-check + production build
```

## Five-minute walkthrough

The **Demo guide** strip under the header follows your progress and ticks off each step from the app's state.

| # | Step | Where |
|---|------|-------|
| 1 | Maya's first outreach goes out by itself when the clock starts. There is no approval step. | Automatic |
| 2 | Tap **Why do I need a crown?** The reply separates Dr. Shah's note from general practice information and cites both sources. | Phone |
| 3 | Tap **Yes, let's find a time** and pick a slot. Maya prefers mornings, so morning slots are offered. | Phone |
| 4 | Click **Simulate cancellation**. The practice cancels because Dr. Shah is unavailable that day, and the coordinator reopens the case with new times. | Reviewer controls |
| 5 | Tap **Check back next week**. The pending follow-up is cancelled, and the timeline records why. | Phone |
| 6 | Click **Skip to Maya's next action**. The coordinator rechecks the record, then sends fresh times. | Reviewer controls |
| 7 | Rebook. If you like, skip ahead to see the reminder and then *Awaiting completion*. | Phone |
| 8 | Click **Record completion**. The case closes and all follow-up stops. | Reviewer controls |

**Supporting cases**
- **Daniel (scheduling only):** he understands the recommendation and books directly. He prefers afternoons.
- **Elena (needs clarification):** after the explanation she asks *Could a filling work instead?* Her record doesn't answer that, so the coordinator says so, offers a discussion with Dr. Bell, and sends her question and context to the dental team. Once the discussion has happened she decides for herself, and the crown stays unscheduled until she does.

**Background cases** give the worklist a realistic spread of states:
- **James:** close to the outreach cap.
- **Aisha:** paused until after her exams.
- **Robert:** already booked.
- **Grace:** completed.
- **Tom:** opted out.
- **Sofia:** declined.

## What the product shows

**Practice view (Option A: patient worklist)**
- **Summary:** active cases, booked, completed, and automated steps (0 needing approval).
- **Search and status filters:** waiting for reply, paused, booked, completed, closed.
- **Worklist rows:** treatment, barrier, status, last action, and next action with its date.
- **Case detail:**
  - The recommendation, with the **clinician-recorded reason** shown apart from general information.
  - Coordination state and booking.
  - The dental-team handoff packet, when there is one.
  - Three tabs:
    - **Activity timeline:** every event with a *why*, plus the next scheduled wake-up.
    - **Conversation:** with per-message sources.
    - **Record & sources:** the chart note as written, the approved patient summary, which questions the note can answer, and the knowledge entries used.
- **Knowledge library:** three entries, each with topic, source, owner and last-updated date. Each entry shows its approved patient wording and which conversations cited it.

**Patient view:** a mobile-style text thread with selectable replies only. Pause, decline and stop are always available under *Pause, decline, or stop*. On narrow screens a Practice/Patient switch replaces the side-by-side layout.

**Reviewer controls** sit in a separate dark bar labelled *Simulation · not part of the product*:
- Simulated clock
- +1 day
- Skip to the patient's next action
- Simulate cancellation
- Record completion
- In the ⋯ menu: Replay last event (shows idempotency) and Reset

## Agent loop and rules

`src/domain/engine.ts` is a pure state machine: `dispatch(state, action)`, plus `tick(state, until)`, which processes due wake-ups in time order.

- **Observe → Decide → Act → Remember → Resume → Close.** Each case stores:
  - its barrier and status
  - the conversation stage
  - cited sources
  - offered slots
  - a pause date
  - a follow-up count
  - a single `next` wake-up with an idempotency key

  Every wake-up rechecks the record before it acts. For example, when a pause ends the coordinator first checks whether something was booked in the meantime.
- Initial outreach is automatic.
- A pause suppresses all intervening follow-up.
- An existing booking suppresses scheduling messages.
- A cancellation reopens coordination unless the patient has paused or stopped. When the practice cancels, that provider-day is removed from future offers.
- Unanswered outreach is capped at the initial message plus 2 follow-ups. The case then shows *No response*, and any later reply reopens it.
- Attendance is not completion. After the visit time passes, the case waits for the practice completion record.
- Decline and STOP end all outreach. START opts back in.
- Every outbound message and wake-up has an idempotency key. Replaying an event, or tapping the same reply twice, creates no duplicate messages or bookings.
- Explanations come only from a clinician note's approved patient summary and the knowledge library. Questions the record doesn't cover (alternatives, urgency) are never answered by guessing; they become an offer of a dentist discussion.

`src/domain/engine.test.ts` covers the main journey, the cap, booking suppression, cancel-while-opted-out, stop, decline, replay idempotency, double-tap, and the clarification path.

State lives in one store shared by both views. It is persisted to `localStorage` and survives refresh, and **Reset** restores the seed exactly, because the schedule and seed data are deterministic.

## What a pilot would measure

The demo counts are simulated activity, not evidence of impact. A pilot would measure:
- additional completed treatments
- staff effort per case
- patient understanding
- opt-out rate

**Out of scope here (expansion):**
- cost and insurance explanations
- voice calls
- multi-visit coordination
- richer treatment explanations and consultation support
- preventive recall
- additional languages and locations

## Layout

```
src/
  domain/   types, seed data, deterministic schedule, engine (+ tests)
  ui/       worklist, case detail, patient phone, knowledge library, demo guide, sim bar
  store.tsx shared state + persistence
```

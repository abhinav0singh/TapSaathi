# TaapSaathi: full handoff for continuing in ChatGPT

Paste this whole file into the new chat. It is a snapshot as of **10 October 2026, about 23:30 IST**. Where something was not verified, it says so. Do not treat any "NOT VERIFIED" item as done.

The demo password is deliberately **not** in this file. Add it yourself if you want ChatGPT to know it: `<demo password, kept out of the repo>`.

---

## FIRST TASK: read and analyze the code base before doing anything else

**Do not plan, propose changes or write code until you have read the repository properly and reported what you found.** This file is a summary written by another assistant; it can be wrong or out of date. Treat the code as the source of truth and tell me wherever the two disagree.

**Getting the code.** The repo is <https://github.com/abhinav0singh/TapSaathi> (branch `main`, which already includes PR #29). If you can browse or clone it, do that. If you cannot, say so immediately and ask me to upload a zip or paste the files, in this priority order: `package.json`, `infra/lib/taapsaathi-stack.ts`, `packages/contracts/src/*.ts`, `services/risk-engine/src/*.ts`, `services/shared/src/*.ts`, `services/api/src/*.ts`, `services/demo/src/*.ts`, `services/intervention/src/*.ts`, `services/weather/src/poll-weather.ts`, `apps/web/app/**`, `apps/web/components/**`, `apps/web/lib/**`, `scripts/*.ts`, `.github/workflows/*.yml`, `amplify.yml`, `README.md` and `docs/*.md`. Do not guess the contents of a file you have not seen.

**Read in this order, and keep notes as you go:**

1. **Contracts first** (`packages/contracts/src/api.ts`, `entities.ts`, `events.ts`): every request, response, entity, status enum and event shape. Everything else depends on these.
2. **The decision logic** (`services/risk-engine/src/policy.ts`, `evaluate-risk.ts`, `process-observation.ts`, `services/shared/src/risk-publisher.ts`): confirm the v2 rules in section 5 match the code, including the exact comparisons (`>=` versus `>`) and rule precedence.
3. **Infrastructure** (`infra/lib/taapsaathi-stack.ts`, `infra/test/stack.test.ts`): every resource, IAM grant, timeout, environment variable, CORS setting, route, authorizer and output. Note anything that differs from section 4.
4. **The Step Functions workflow** (`services/intervention/src/*.ts` plus the state machine definition in the stack): trace every state and transition, including the take-break, unwell, timeout, supervisor-acknowledged and supervisor-unacknowledged branches, the callback task token, the stale-generation handling and the terminal statuses.
5. **Persistence** (`services/shared/src/dynamo-repository.ts`, `memory-repository.ts`, `repository.ts`, `seed.ts`): table keys, GSIs, every transaction and its condition expressions, idempotency keys, the demo-generation mechanism, TTLs. Check that the in-memory repository really mirrors the DynamoDB one.
6. **The HTTP handlers** (`services/api/src/*.ts`, `services/demo/src/*.ts`, `services/shared/src/auth.ts`, `identity-mapping.ts`, `runtime-identity-mapping.ts`, `http.ts`, `errors.ts`): authentication and authorization on every route, actor and role checks, error codes and messages, input validation.
7. **The frontend** (`apps/web/app/**`, `apps/web/components/**`, `apps/web/lib/**`): routing, role guards, the API client and its schemas, polling cadence, every rider, supervisor and operator state, every user-facing message in English and Hindi, accessibility, and the recorded-run page at `/demo`.
8. **Tests and CI** (`**/tests/**`, `*.test.ts`, `vitest.config.ts`, `.github/workflows/*.yml`): what is actually covered, what is only mocked, and what is not tested at all.
9. **Docs and scripts** (`README.md`, `docs/*.md`, `scripts/*.ts`, `amplify.yml`): which claims are verified, which are stale, and which contradict the code.

**Then give me an analysis report before anything else. It must contain:**

- A short, accurate description of how the system works end to end, in your own words, and a list of anything in this handoff that the code contradicts.
- **Bugs and risks** you found, each with the file and line, what goes wrong, how likely it is, and how severe. Separate real defects from guesses, and say how sure you are.
- **Security and safety review:** unauthenticated or over-permissive routes, role or actor checks that can be bypassed, anything that could leak a secret or a signed URL, anything that could let a rider act for another rider, and any place the system could imply a medical claim or an emergency call.
- **Consistency gaps:** UI copy, API error text, docs and README claims that disagree with the behaviour, hardcoded names or values, dead code, and states that the frontend cannot reach or the backend never produces.
- **Test gaps:** behaviour that matters for the demo but has no test, and tests that pass only because they mock the thing they claim to test.
- **Demo risks:** anything that could fail during a judge's visit or while recording the video (timeouts, cold starts, stale generations, CORS, expired signed URLs, session expiry, rate limits).
- **Score impact:** for each finding, which of the five criteria it affects (Built on AWS, Idea and Impact, Execution, Design and Usability, Demo Video) and roughly how many points are at stake.
- **What you could not check** and why.

Only after I have read your report and agreed with it should you propose a plan. Base the plan on what you found, not only on the phase list below; where your analysis disagrees with the phases, say so and explain why.

**Rules for this analysis:** quote file paths and line numbers for every claim; never describe code you have not read; mark each statement as VERIFIED (you saw it in the code), INFERRED (you reasoned it from the code) or UNKNOWN; and do not change anything yet.

---

## 0. How to behave in this chat (preferences learned so far)

1. End **every** reply with a clearly labelled **"Your next steps"** list of what the user must do themselves, in order. If nothing is needed, say so.
2. Put each runnable shell command in its own fenced `bash` block.
3. Never invent evidence. A gate is PASS only with a real execution ARN, queried record, command output or screenshot. Otherwise write NOT VERIFIED.
4. Never invent statistics. Every figure needs a named source the team can check.
5. No medical claims, no diagnosis, no automatic emergency calls. Keep the disclaimer. Simulated data stays visibly labelled simulated.
6. No secrets (passwords, tokens, keys) in the repo, docs or code.
7. The safety policy stays deterministic. No LLM in the decision path.
8. Reliability beats features: one workflow that runs beats five that almost do.
9. Report outcomes faithfully. If a check failed or was skipped, say so.
10. Before deleting or overwriting anything, look at what is there and say what would be lost. (A real loss happened: see section 3.)
11. Commits made with Claude carry the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. This matters for the AI-tools disclosure below.

---

## 1. The hackathon

- **Event:** Environmental Hacks, event 02 of the WeMakeDevs x AWS "Bharat Builds Tour". Page: <https://www.wemakedevs.org/aws/env>.
- **Dates:** online Thursday to Sunday, **Oct 8 to 11, 2026**. Optional in-person build day at DTU Delhi on Sat Oct 10 (adds nothing to the score).
- **Track chosen:** **Heat and Water** (heatwaves, floods, droughts, water tankers, leaks, groundwater). Other tracks: Air; Waste and Energy.
- **Teams:** 1 to 4 students in India. Students must verify on AWS Builder Center. **The team confirmed both members are student-verified.**
- **Eligibility to win a prize:** the project must use at least one AWS open-source tool or be deployed on AWS.
- **Prizes:** track winner ₹2,00,000 plus $2,000 AWS credits; top 4 runners-up get $1,000 credits; top 10 students get fast-track Amazon interviews; top 5 blogs (published on AWS Builder Center and linked in the submission) win AirPods. $200 free-tier credits, plus $25 more on request.
- **Submission deadline:** the schedule says submissions close **Sunday Oct 11**; the exact time is not published. Submit early.
- **Rules page:** <https://www.wemakedevs.org/aws/rules>. A review the team pasted earlier said the rules disqualify repos whose history does not match the event dates and require the writeup to list AI tools used and the video to show AWS in use. I did **not** read the rules page myself. **Read it before submitting.**

### Judging rubric (30 points)

| Criterion | Max | What judges look for |
| --- | --- | --- |
| Built on AWS | 10 | AWS open-source tools or AWS services; mandatory to win |
| Idea and Impact | 8 | A real environmental problem; what changes for the people living with it; a small problem solved well beats a big one solved vaguely |
| Execution | 4 | Does it work; one feature that runs beats five that almost do |
| Design and Usability | 4 | The people with the problem can use it; someone outside the team knows what to do |
| Demo Video | 4 | Three minutes, recorded. **No live demo**: the video is what judges see (what it does, who it is for, where AWS fits) |

Projects built locally and projects deployed on AWS are scored equally. Each track is judged on its own. The previous hackathon score the team mentioned was 14/30.

### Score estimates (mine; not judged scores)

Start of this work: about 20/30 (my repo read) to 23-25 (another review of the live app). Treat the true figure as about 22-24. Realistic target 26-28.

---

## 2. The project

**TaapSaathi** is an event-driven heat-safety and dispatch layer for last-mile delivery riders in India. It is not another heat dashboard: it handles the response after a warning. A deterministic policy turns a heat observation into a real EventBridge event, which starts a Standard Step Functions intervention. The rider gets Amazon Location route guidance to a simulated rest point and Amazon Polly audio (Hindi/English), then answers with one tap (**Take a break** or **I feel unwell**). A break reassigns the active delivery to another rider. A symptom report or a timeout escalates to a human supervisor. Every step is written to a DynamoDB audit trail.

It does not make medical claims, does not contact emergency services, and labels all weather, riders and rest points as simulated. The product pays off for the fleet operator, not the rider (PRD).

**Demo scope:** one hub (`hub-delhi-001`, "Delhi North Demo Hub"), three riders, one supervisor, one active delivery, three seeded rest points.

- Riders: `ravi-001` (75 active minutes; the main rider), `asha-001` (20; the reassignment target), `imran-001` (50).
- Supervisor: `supervisor-neha-001`. Delivery: `delivery-001`.
- Rest points: three "Demonstration" points (Connaught Place water point, Mandi House shade point, India Gate rest point).
- Only `ravi-001` crosses the exposure limit (60 minutes) during a spike, so only Ravi triggers an intervention; Imran shows CAUTION.

---

## 3. People, repo and environments

- **Repo:** <https://github.com/abhinav0singh/TapSaathi> (default branch `main`). Contributors: Abhinav Singh (owner, GitHub `abhinav0singh`) and KaranLalwani-dev (the user; local git user and `gh` login). Some commits are authored as "Claude" (AI-assisted; see disclosure below).
- **History window:** the first commit is dated **9 Oct 2026**, inside the Oct 8-11 window. Nothing earlier was found.
- **Region:** `ap-south-1` (Mumbai). **AWS account:** `202823104630`. **Stack:** `TaapSaathiStack`.
- **Hosted frontend (Amplify):** <https://main.d6hf0wv24qbik.amplifyapp.com>
- **API:** <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- **Cognito:** user pool `ap-south-1_cgIO5dxFX`, app client `2uncftp6ql3a84krgskgrdoq11` (SRP auth only; password policy 12+ chars with upper, lower, digit and symbol). Both ids are public (they are in `apps/web/.env.example`).
- **Local AWS profile:** `taapsaathi-dev` (IAM Identity Center). Its role is `TaapSaathi-Verification-Dev`: **read/verify only**. It can describe the stack and call the public API, but it **cannot** deploy, assume the CDK roles, read the CDK bootstrap SSM parameter, call `GetFunctionConfiguration`, call `states:ListExecutions`, or list API Gateway APIs.
- **Deploys are done by the AWS owner (probably Abhinav)** with a deploy-capable identity. The user cannot deploy.

### Local checkouts on the user's Mac (changed at about 23:30 IST)

- **Only one folder remains: `/Users/sakai/TapSaathi`**, a fresh clone of `main` at commit `d33eb36` (it includes PR #29). The user renamed the fresh clone to this path. Dependencies are not installed there yet.
- The previous `/Users/sakai/TapSaathi` (with uncommitted work) and the git worktree `/Users/sakai/TapSaathi-policy` no longer exist. The user asked for them to be deleted, and they were gone before the assistant ran any delete command, so the assistant did not delete them.
- **Lost because they existed only in the deleted folders (never pushed):** (1) the user's uncommitted map work (`apps/web/components/OperationsMap.tsx`, `apps/web/lib/operationsMapData.ts`, `apps/web/lib/operationsMapData.test.ts`, plus edits to `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/ops/page.tsx`); (2) the first copy of this handoff file and a `docs/SCORE_RAMP_PLAN.md` (this file's phase list contains the same plan). `origin/main` has its own map at `apps/web/components/ops/OperationsMap.tsx` and there are upstream branches such as `codex/operations-map-polish`, so the lost work was probably superseded, but that was never verified. The assistant did not check the old folders for unpushed commits or stashes before they disappeared, so it cannot say whether anything else was lost.

---

## 4. Architecture and repo layout

```text
EventBridge Scheduler -> Weather Lambda  ┐
Demo API (heat-spike)  -> shared risk processor -> custom EventBridge bus
                                                    -> Standard Step Functions
                                                       (DynamoDB, Amazon Location Routes, Polly -> private S3 audio)
HTTP API (Cognito JWT authorizer) -> API Lambdas -> DynamoDB / Step Functions
```

AWS services in use: Lambda (Node 22), DynamoDB (on-demand), EventBridge (custom bus) and Scheduler, Step Functions Standard (callback task token), API Gateway HTTP API with a Cognito JWT authorizer, Amazon Location Routes, Polly, S3 (private audio, 7-day expiry), CloudWatch (logs kept one week) and X-Ray, SSM Parameter Store (identity mapping `/taapsaathi/demo/identity-mapping`), Cognito, Amplify Hosting, CDK v2.

```text
infra/                 CDK stack + assertion tests (infra/lib/taapsaathi-stack.ts)
packages/contracts/    shared Zod schemas (api.ts, entities.ts, events.ts)
services/api/          GET handlers and POST respond / resume-worker
services/demo/         heat-spike, reset, seed
services/intervention/ Step Functions task handlers
services/risk-engine/  pure deterministic policy + observation processor
services/shared/       DynamoDB repo, in-memory test double, auth, config
services/weather/      scheduled weather adapter (poll-weather.ts)
scripts/               deployed-smoke.ts, validate-state-machine.ts
apps/web/              Next.js 16 / React 19 / Tailwind frontend
docs/                  OpenAPI, runbooks, verification and evidence docs, specs
.github/workflows/     backend.yml and web.yml (both pass on main)
```

- Mutations (`POST /demo/heat-spike`, `POST /demo/reset`, `POST /interventions/{id}/respond`, `POST /workers/{id}/resume`) need a Cognito JWT. `GET /health`, `/dashboard`, `/workers/{id}`, `/events` are public (read-only).
- Identity mapping only allows these actor ids: `ravi-001`, `asha-001`, `imran-001` (WORKER) and `supervisor-neha-001` (SUPERVISOR); `OPERATOR` has no actor id.
- Response timeouts default to **120 s** (worker) and **120 s** (supervisor) via `WORKER_RESPONSE_TIMEOUT_SECONDS` / `SUPERVISOR_RESPONSE_TIMEOUT_SECONDS` (CDK context or env).
- CORS comes from env `FRONTEND_ORIGINS` (default `http://localhost:3000`). It feeds the HTTP API CORS, the audio bucket CORS and the Lambda env. **A deploy without it set would drop the Amplify origin and break the hosted site.** Live value: `http://localhost:3000,https://main.d6hf0wv24qbik.amplifyapp.com`.
- Weather Lambda `WEATHER_MODE` is fixed to `cached` in the stack (`infra/lib/taapsaathi-stack.ts`, near line 277). Cached baseline: 34 C air, 38% humidity, 36 C apparent, no alert. Live mode (Open-Meteo, Delhi) exists in `services/weather/src/poll-weather.ts` but is not enabled in the deployment.

### Web routes

`/` landing, `/login`, `/ops` (operations board; public read-only for signed-out visitors; actions need OPERATOR/SUPERVISOR), `/supervisor` (response desk), `/worker/[workerId]` (rider screen; public read-only preview, actions need that rider's own session), `/demo` (public recorded-run replay, added in PR #29).

---

## 5. The risk policy (heat-policy-v2): what changed and why

Before, `services/risk-engine/src/policy.ts` copied temperature and humidity into an `evidence` object but decided only from the `officialHeatAlert` boolean and active minutes, and live weather could never trigger a workflow. Now (PR #25, merged and deployed):

Precedence, first match wins:

1. `symptomReported` -> CRITICAL, `WORKER_REPORTED_SYMPTOM`, ESCALATE.
2. Apparent temperature **>= 52 C** -> HIGH, `EXTREME_HEAT_INDEX`, TAKE_BREAK (regardless of exposure).
3. Official alert **and** active minutes >= max (60) -> HIGH, `HEAT_ALERT_WITH_ACTIVE_EXPOSURE`.
4. Official alert -> CAUTION, `OFFICIAL_HEAT_ALERT`.
5. Apparent **>= 39 C** or air temperature **>= 45 C**: with active exposure -> HIGH `HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE`; otherwise CAUTION `HEAT_THRESHOLD`.
6. Apparent **>= 32 C** -> CAUTION, `ELEVATED_HEAT_INDEX`.
7. Otherwise SAFE, `NO_POLICY_MATCH`.

Only HIGH and CRITICAL raise an event. Policy version string is `heat-policy-v2`. Thresholds live in `HEAT_THRESHOLDS` in `policy.ts`. **The thresholds resemble the US NWS heat-index categories but are demonstration policy, not medical advice, and are NOT verified against IMD/NDMA/NWS. Check and cite a source before claiming they are authoritative.** The demo spike (`services/demo/src/heat-spike.ts`) now sets `officialHeatAlert: false` with 45.2 C air / 49.1 C apparent / 42% humidity, so the readings decide. The live weather adapter still never asserts an official alert.

---

## 6. Everything done so far (PR ledger)

| PR | Status | What |
| --- | --- | --- |
| #25 | merged, deployed | Policy v2: decide from readings; new `matchedRule` values in the contract; spike no longer asserts an alert; tests |
| #26 | merged, deployed (stack updated 16:39 UTC) | Rider can resume after a **supervisor-acknowledged symptom report**, with a required "I feel well enough" confirmation (`selfDeclaredFit: true`); API refuses without it (400 `FITNESS_CONFIRMATION_REQUIRED`) and refuses unacknowledged alerts (409); audit records `afterSymptomReport` and `selfDeclaredFit`; repository `resumeWorker` takes `fromState` (`RESTING` or `AWAITING_SUPERVISOR`) |
| #27 | merged; frontend via Amplify, **backend error wording not deployed** (merged 16:45 UTC, after the 16:39 deploy) | Removed stale "NOT CLEARED" wording (ops badge now `ACKNOWLEDGED · MAY RESUME`), removed hardcoded "Ravi" in rider preview text (now uses the rider's name, gender-neutral), updated resume error messages, runbook and known limitations |
| #28 | merged | `docs/GOLDEN_PATH_EVIDENCE.md` (the two recorded runs and what is not verified) |
| #29 | **merged** (`d33eb36`), frontend only | Phase 2: public `/demo` recorded-run page, judge note on `/login`, links on the landing page and nav, "140+ tests" instead of the stale "139", hero card labelled illustration, judge section at the top of `docs/JUDGE_DEMO_RUNBOOK.md`. **Whether Amplify has rebuilt and `/demo` is live was not confirmed.** |

Also done: Phase 0 checks (history inside the window; both teammates student-verified). Earlier work by others on `main`: Cognito auth + SSM identity mapping, supervisor-delivery-lifecycle fix, authenticated deployed smoke, stale-reset fix, backend CI, judge-ready frontend, Amplify build spec (`amplify.yml`), README value story, presentation upgrade, rider resume flow (PR #24).

### Verification run locally (latest, before the folders were deleted)

Typecheck clean; zero-dependency policy tests 3/3; unit suite 150 tests (backend plus web) pass; infra tests 16 pass; CDK `synth` and `verify:definition` pass (`verify:definition` needs `npm run synth` first); web production build passes. CI (`backend.yml` and `web.yml`) was green on each merged PR.

---

## 7. Evidence collected from the deployed system (heat-policy-v2)

Source: the public `GET /events` and `GET /dashboard`, read during live runs on 10 Oct 2026. A **reset removes older generations from `/events`**, so these are saved in `docs/GOLDEN_PATH_EVIDENCE.md`.

**Run 1: take break (generation 17), intervention `int-752e81bf264ea779864d`.** Rider signed in via Cognito as `demo-ravi`.
16:22:11 `INTERVENTION_CREATED` (v2, `HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE`, HIGH, no alert flag) -> 16:22:13 `GUIDANCE_PREPARED` (`AMAZON_LOCATION`, 3,741 m / 804 s; Polly audio created and fetchable: HTTP 200, `audio/mpeg`, 40 KB) -> 16:22:14 `WORKER_RESPONSE_REQUESTED` (120 s) -> 16:23:12 `RESPONSE_ACCEPTED` (WORKER, `TAKE_BREAK`) -> 16:23:13 `DELIVERY_REASSIGNED` (`delivery-001` to `asha-001`) -> 16:23:14 `INTERVENTION_COMPLETED` (`COMPLETED`). Final: Ravi RESTING, Asha SAFE, delivery with Asha.

**Run 2: feel unwell, acknowledge, resume (generation 20), intervention `int-6f402477a2e3486fb1c3`.**
16:40:35 created (v2) -> 16:40:36 guidance -> 16:40:37 response requested -> 16:40:45 `RESPONSE_ACCEPTED` (WORKER, `FEEL_UNWELL`) -> 16:40:46 `DELIVERY_REASSIGNED` (before escalation) -> 16:40:47 `SUPERVISOR_ESCALATED` (`FEEL_UNWELL`) and `SUPERVISOR_RESPONSE_REQUESTED` -> 16:41:12 `RESPONSE_ACCEPTED` (SUPERVISOR `supervisor-neha-001`, `SUPERVISOR_ACK`) -> 16:41:13 `INTERVENTION_COMPLETED` (`SUPERVISOR_RESPONDING`) -> 16:41:22 `RIDER_RESUMED_WORK` (`previousState` `AWAITING_SUPERVISOR`, `afterSymptomReport` true, `selfDeclaredFit` true). Final: Ravi SAFE, delivery with Asha, nothing active.

An earlier policy-suppressed event also confirmed v2 decides: a spike while Ravi was still RESTING produced `INTERVENTION_SUPPRESSED` (`WORKER_UNAVAILABLE`) carrying `heat-policy-v2` and the matched rule.

An older timeout-escalation verification (10 Oct, before v2) is in `docs/AWS_TIMEOUT_ESCALATION_VERIFICATION.md` (execution `SUCCEEDED`; reassignment before supervisor escalation). It used synthetic JWT claim contexts, **not** a real browser sign-in, and was produced under v1.

**What this proves:** the policy decides from readings with no official alert; real Cognito sign-in for a rider and a supervisor works through the API Gateway JWT authorizer; Amazon Location routing, Polly audio, EventBridge, Step Functions, DynamoDB reassignment and supervisor escalation run on AWS; a rider can resume after a supervisor-acknowledged report with an audited self-declaration.

---

## 8. What is NOT verified or not done (be honest about these)

- **Step Functions execution ARNs** for the runs above: not captured (the user's role cannot list executions). Standard workflow history is kept 90 days. Copy them from the console: Step Functions -> `InterventionStateMachine…` -> Executions (runs started about 16:22 UTC and 16:40 UTC on 10 Oct), and a screenshot of the execution graph for the video.
- Only **one** take-break run and **one** unwell run recorded. The plan wanted three consecutive clean take-break runs.
- **Resume after a break was not re-run** after the post-symptom resume change (PR #26 altered the repository condition). Do one take-break + resume regression run.
- **Not verified under v2:** timeout escalation, duplicate-event replay, stale callback after reset, and the idempotency invariant. Earlier "PENDING" README gates should be re-checked against the README as it stands now (the README was not re-read after the README PRs).
- **An unacknowledged escalation blocks resume** on purpose (no human has seen the report). The user may want that case handled differently; it is an open decision.
- PR #27's **backend** wording change is not deployed. It only changes error text.
- **Amplify rebuild after PR #29** and the live `/demo` page were not confirmed.
- **Cognito accounts:** on 9 Oct the rider/supervisor accounts were in `FORCE_CHANGE_PASSWORD` and the web app rejects that challenge. Since then `demo-ravi` and `demo-neha` were used to sign in successfully. The user says `demo-asha` and `demo-imran` can also sign in (not seen by the assistant). **The shared demo password has been chosen but is not yet confirmed set in Cognito.**
- **Not done at all:** the demo video, README rewrite check, impact statistics with sources, accessibility pass, architecture diagram PNG, writeup (with AI-tool disclosure), Builder Center blog, live-weather display, historical-weather replay, issue #8 closure (three-role browser evidence; status unknown), Amazon Location map tiles.
- The thresholds in section 5 are unverified against authoritative sources.
- The rules page was not read by the assistant, so rule claims above come from a pasted review.

---

## 9. Phase 2 detail (PR #29, merged)

Why: judges see only the video, repo and live site. The board was already public read-only, but an idle board shows nothing and the actions need a login.

- **`/demo` "Recorded run"** (`apps/web/app/demo/page.tsx`, data in `apps/web/lib/recordedRuns.ts`, tests in `apps/web/lib/recordedRuns.test.ts`): a step-through replay of Run 1 and Run 2 with the rider screen, the operations board (Ravi/Asha/Imran states, delivery owner) and the AWS service per step. Controls: Back, Play/Pause, Next, click any step. It states it is a replay of simulated data and links to the read-only board. Checked in a browser at desktop and 375 px; fixed horizontal overflow and long-word wrapping; the detail panel comes first on small screens.
- Worker states in the replay change only where the dashboard showed a change; between those steps the previous state is carried forward (stated in the file comment).
- `/login` has a "Reviewing this project?" note listing `demo-operator`, `demo-ravi`, `demo-neha` and saying the password is in the submission writeup.
- **Decision:** the demo password is **not** stored in the repo (the repo is public); it goes only in the submission writeup. The shared demo password is the user's final choice (not repeated here). It meets the Cognito policy. It must be set on `demo-operator`, `demo-ravi`, `demo-neha` by someone with Cognito admin rights:
  `aws cognito-idp admin-set-user-password --user-pool-id ap-south-1_cgIO5dxFX --username <name> --password '<password>' --permanent --region ap-south-1`
- Rotate or delete the three demo accounts after judging.

---

## 10. Remaining plan (phases 3 to 8) with criteria impact

"main" = main driver of that criterion. Points are estimates.

| Phase | Work | AWS 10 | Idea 8 | Exec 4 | Design 4 | Video 4 |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | Prove it on AWS (remaining gates, ARNs) | main | - | main | - | helps |
| 4 | Real data and cited impact | helps | main | helps | - | helps |
| 5 | Demo video (3 min) | helps | helps | helps | helps | main |
| 6 | Writeup and README | helps | main | helps | helps | - |
| 7 | Design and usability polish | - | - | helps | main | helps |
| 8 | Final hardening | helps | - | helps | - | helps |

**Phase 3: prove it on AWS (do next).** Tasks: (a) one take-break + resume regression run; (b) copy Step Functions ARNs and a graph screenshot for both recorded runs; (c) verify duplicate-event replay does not create a second intervention or reassignment; (d) verify a stale callback after reset is rejected; (e) timeout escalation under v2 (wait 2+ minutes, or the owner deploys with a shorter timeout via CDK context, and say so in the video if shortened); (f) Hindi Polly audio in private S3 plus a presigned GET, and persisted `provider: AMAZON_LOCATION` route (already seen in runs; capture formally); (g) real JWT authorizer checks: no token -> 401, worker token on `/demo/reset` -> refused, Ravi cannot answer as Asha; (h) extend `scripts/deployed-smoke.ts` with the unwell branch; (i) update the README release-evidence table, `docs/VERIFICATION_STATUS.md` and `docs/PROJECT_STATUS.md` only with proven results.

**Phase 4: real data and cited impact.** Historical-weather replay from a past Delhi heatwave day (Open-Meteo historical API) through the same policy, clearly labelled replay (October live weather will not show a heat event); an impact panel on `/ops` computed only from real audit events (time from trigger to reassignment, response time, escalations); 2-3 statistics on gig-worker heat exposure, each with a named source and year that the team checks; one measured number from the audit log (measure system latency separately from the rider's own response time); tie rest points to water/shade for Heat and Water.

**Phase 5: demo video (3:00, currently zero).** Script: 0:00-0:20 problem and who it is for (cited statistic); 0:20-0:50 a real reading flows into a named rule (show heat-policy-v2); 0:50-1:20 rider phone: Hindi audio, route, one tap; 1:20-1:50 ops map and delivery reassignment, live timeline; 1:50-2:20 *I feel unwell* -> supervisor escalation -> resume; 2:20-2:50 AWS console: Step Functions execution graph, EventBridge event, DynamoDB audit items, X-Ray trace, one line per service; 2:50-3:00 honest limits and next steps. Say the engine is deterministic on purpose. Prepare: clean reset, rehearsal, logins ready, audio on, no secrets or account ids visible. Upload public or unlisted on YouTube and test it signed out.

**Phase 6: writeup and README.** Writeup must cover problem, how it was built, where AWS fits, and **every AI tool used (Claude, Codex, and any other)**. Re-check the README for encoding problems (an earlier terminal read showed garbled characters; it may since have been rewritten). Use one name: **TaapSaathi**. Architecture diagram as a PNG in the repo. Put the demo password in the writeup only.

**Phase 7: design and usability.** Rider screen at 375 px: touch targets at least 48 px, strong contrast, language toggle visible, offline message. Accessibility: labelled controls, focus order, `aria-live`, never colour alone. Run Lighthouse accessibility and report the real score. Optional: Amazon Location map tiles instead of OpenFreeMap (`NEXT_PUBLIC_MAP_STYLE_URL`, default `tiles.openfreemap.org`). One cold-user test with someone outside the team. Add frontend tests for rider state logic.

**Phase 8: final hardening.** Full local checklist (`npm run typecheck`, `test:unit`, `test:infra`, `synth`, `verify:definition`, web typecheck and build), final deployed smoke, search the repo and video for secrets, AWS Budget alert, release tag, teardown and cost note, rotate/delete demo accounts after judging, submit early.

**Cut order if time runs short:** Amazon Location tiles, blog, SNS email -> extra frontend tests -> map polish -> historical replay. **Never cut:** a hosted working app, the video, and evidence for the golden path.

### Score projection (estimates only)

Start about 23 -> after Phase 3 about 26 -> after Phase 4 about 26.8 -> after Phase 5 about 28.6 -> after Phases 6-7 about 29. Plan on 26-28; treat the rest as a bonus.

### Items from the earlier live-app review (A1-D3) and their status

A1 policy uses readings: **done**. A2 live weather can trigger: **done in code** (the cached baseline still runs on the schedule; live mode is not enabled in the stack). A3 spike injects numbers: **done**. A4 eligibility: history OK, students verified, **AI-tool disclosure pending**. A5 judges can access without credentials: **done and merged in PR #29, not confirmed live**. B1 re-time the video: pending. B2 show AWS on screen: pending. B3 historical replay: pending. B4 public rider demo state: the rider screen is already public read-only. B5 close issue #8: status unknown. C1 cited statistics: pending. C2 accessibility: pending. C3 diagram PNG: pending. C4 say it is deterministic by design: pending (video). D1 Amazon Location tiles: pending. D2 Builder Center blog: pending. D3 SNS email on escalation: optional.

---

## 11. How to run things

Work from `/Users/sakai/TapSaathi`.

**Local frontend against the deployed API** (the API's CORS already allows `http://localhost:3000`; real Cognito sign-in works):

```bash
cd /Users/sakai/TapSaathi && npm ci && npm run build --workspace=@taapsaathi/contracts
cp apps/web/.env.example apps/web/.env.local
npm run dev --workspace=@taapsaathi/web
```

**Local backend checks:**

```bash
npm run typecheck && npm run test:unit && npm run test:infra && npm run synth && npm run verify:definition
```

`npm run build --workspace=@taapsaathi/contracts` must run first in a fresh checkout. `verify:definition` needs `npm run synth` first.

**Deploy (needs a deploy-capable AWS identity, not the user's verification role):**

```bash
git pull origin main && npm ci && npm run build --workspace=@taapsaathi/contracts && FRONTEND_ORIGINS="http://localhost:3000,https://main.d6hf0wv24qbik.amplifyapp.com" npm run deploy
```

For a read-only preview, `cdk diff` worked with the user's role after exporting credentials (`eval "$(aws configure export-credentials --profile taapsaathi-dev --format env)"`) and setting `CDK_DEFAULT_ACCOUNT=202823104630 CDK_DEFAULT_REGION=ap-south-1 FRONTEND_ORIGINS=…`. The last `cdk diff` showed code-only changes in 18 Lambda bundles and no IAM, CORS or resource changes. **A real deploy with the user's role failed:** it cannot assume `cdk-hnb659fds-deploy-role-…` or read `/cdk-bootstrap/hnb659fds/version`. To fix it, the account admin can add this to the Identity Center permission set `TaapSaathi-Verification-Dev` (a broader role also works): `sts:AssumeRole` on `arn:aws:iam::202823104630:role/cdk-hnb659fds-{deploy,file-publishing,lookup,image-publishing}-role-202823104630-ap-south-1`, and `ssm:GetParameter` on `arn:aws:ssm:ap-south-1:202823104630:parameter/cdk-bootstrap/hnb659fds/version`. This is a real privilege increase; let the admin approve it. Otherwise the owner runs the deploy.

**Deployed smoke** needs env `API_URL`, `OPERATOR_ACCESS_TOKEN`, `WORKER_ACCESS_TOKEN` (real Cognito access tokens; never commit them), optional `STACK_NAME`, `AWS_PROFILE`, `AWS_REGION`: `npm run smoke:deployed`. It does reset -> spike -> wait for `AWAITING_WORKER` -> worker `TAKE_BREAK` -> wait for Ravi RESTING and `delivery-001` with Asha -> match a Step Functions execution and assert `SUCCEEDED`. It reads Step Functions, so it needs a role that can list executions.

**Checking a run without a token** (the audit log is public):

```bash
curl -s https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com/events
curl -s https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com/dashboard
```

A heat spike or reset needs an operator login (press the buttons on the hosted `/ops` page). Sequence for a clean run: **Reset**, confirm Ravi is SAFE, **Trigger heat spike**, then within 120 seconds act as Ravi on `/worker/ravi-001`.

---

## 12. Known limitations to state honestly (also in `docs/KNOWN_LIMITATIONS.md`)

- Public demonstration environment; not production access control.
- Weather defaults to a cached non-alert baseline; live Open-Meteo is not enabled in the deployment and never asserts an official alert.
- Weather, riders, rest points and the hub are simulated and labelled.
- Policy thresholds are demonstration policy, not medical advice, and are unverified against official sources.
- A rider's resume after a symptom report is self-declared and audited; it is not a medical clearance. An unacknowledged escalation does not allow self-resume.
- Reset scans a small single-hub partition by marker.
- No real dispatch, push, SMS/WhatsApp or emergency-services integration.
- The Amazon Location fallback is straight-line selection, labelled unavailable, never presented as an AWS-calculated route.
- AWS cost: on-demand services can incur charges; logs expire after a week and audio after seven days; `npm run destroy -- --profile taapsaathi-dev` removes the stack (deletes demo data).

---

## 13. The user's open to-do list, in order

1. Confirm Amplify rebuilt from `main` after PR #29, then open `/demo` on a phone, signed out, over mobile data.
2. Have someone with Cognito admin set the chosen demo password on `demo-operator`, `demo-ravi`, `demo-neha`; test each login on the live site (operator lands on operations, rider on the rider screen, Neha on the supervisor desk).
3. Ask the AWS owner to redeploy `main` once (with `FRONTEND_ORIGINS` set) so PR #27's backend wording is live.
4. Run the take-break + resume regression run; capture Step Functions ARNs and graph screenshots for the two recorded runs.
5. Continue with Phase 3 (remaining gates), then 4, 5, 6, 7, 8 as above.
6. Read the rules page; prepare the writeup with the AI-tool list; keep the password out of the repo.
7. After judging: change or delete the demo accounts.

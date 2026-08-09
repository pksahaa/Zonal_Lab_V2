# Zonal Water Quality Lab — LIMS

Split version of `Water_Quality_Lab_LIMS_Standalone_V2.html` for GitHub deployment.
No build step needed — this is plain JS loaded via `<script src="">` tags in order,
exactly like the original single-file version.

## Structure

**Note:** files are flat in the repo root (no `js/` subfolder) — this matches
how they were uploaded to GitHub via drag-and-drop, which doesn't preserve
folder structure. `index.html` references them without a `js/` prefix.

```
index.html                          # shell: CDN libs + CSS link + script tags in order
style.css                           # global styles
00-core.js                          # theme, i18n, date/number helpers, icon set
01-data-service.js                  # DataService (storage/backend abstraction)
02-ui-kit.js                        # Badge, Modal, Button, TextField, etc.
05-seed-data.js                     # demo seed data generators
06-legacy-storage.js                # localStorage load/save helpers
10-inventory-logic.js               # chemical/gas/glassware/equipment logic
10b-formula-engine.js               # formula tokenizer/parser/evaluator
11-inventory-ui.js                  # InventoryTab + related forms/modals
12-testtypes-ui.js                  # TestTypeBuilder, TestTypesTab
13-testrecords-ui.js                # AddTestTab, TestRecordsTab
14a-charts-and-filters.js           # chart primitives, DataTable, FilterPanel
14b-analytics-pages-1.js            # Executive/Insights/Test/Tech/Revenue/Chemical pages
14c-analytics-pages-2.js            # Inventory/Glassware/Gas/Equipment/Trends/Forecast pages
15-qc-module.js                     # Westgard rules, control charts, QcModuleTab
16-sub-batch.js                     # Sub-Batch model + getSampleResultForTest lookup
17-report-generator.js              # Custom Report Generator (official DPHE report format)
20-sample-model.js                  # sample lifecycle/status logic
21-sample-ui.js                     # SamplesTab (Samples Registration + Create Analytical Batch sub-tabs), forms, QC banner, bulk manifest upload
22-results-workflow-ui.js           # Samples tab's 3rd sub-tab: Upload/Review/Approve/Release, consolidated + role-gated (see note below)
30-dashboard.js                     # DashboardTab, SampleKpiStrip
40-auth-ui.js                       # LoginPage
99-app.js                           # AppRoot, LabApp, ReactDOM.render
```

## 2026-07-30 — Results Workflow consolidation

"Upload results / Review / Approve / Release" used to be scattered across
three places: Sample Detail's per-parameter buttons + whole-sample signature
panel, Create Analytical Batch's per-row buttons, and its "Batch Actions"
toolbar (Batch Approve/Release by Reference). All three are now **read-only
status + a deep-link** — the actions themselves live in one place: Samples →
**Results Workflow** (`22-results-workflow-ui.js`), reached via
`goToResultsWorkflow()` in `99-app.js`.

- Groups by `testTypeId` across **all** samples needing a step, regardless of
  whether they were tested via a Sub-Batch, Batch(Reference) mode, or an
  individual entry — one queue per step, not per grouping mechanism.
- Role-gated using the existing `permissionsFor()` (`20-sample-model.js`):
  a stage is hidden entirely (not just disabled) unless the signed-in role
  has that permission. Technician (the "Analyzer" role) has
  `canEnterResults` only, so it sees **only** Pending Upload.
- No new decision logic — every action calls the same
  `bulkDecideParameter` / `bulkReleaseParameter` / `setRequestedTestStatus`
  functions the old locations used.
- "Matrix" field in Sample Detail's edit view was renamed to "Sample Type"
  to match the Registration form's label for the same underlying
  `sample.matrix` field (was previously two different labels for one field).


## Why this split

The original standalone file had `// ===== filename.js =====` marker comments
showing it was originally built from these same modules by a build script.
This split restores that structure (the two large `14-reports-ui.js` /
`14b-analytics-pages.js` files were further divided since they'd grown too
large to edit efficiently).

**Load order matters** — later files reference functions/constants defined in
earlier ones, same as the original single `<script>` block. Don't reorder the
`<script src>` tags in `index.html`.

## Deploying to GitHub Pages

1. Upload/push all files listed above to your repo root (flat, no subfolder).
2. Settings → Pages → deploy from the branch containing `index.html`.
3. No build step, no npm install — it's static files served as-is.

## Editing going forward

Since each file maps to one feature area, when you want a change just say
which part it touches (e.g. "the inventory tab" → `11-inventory-ui.js`,
"the chemical analytics chart" → `14b-analytics-pages-1.js`) and only that
file needs to be opened/edited — much cheaper than re-processing the whole
15,000-line file each time.

## QC Module (added)

- Data source: `qcCheck` on test records (`13-testrecords-ui.js`), grouped by
  method (testTypeId) + QC type (blank/duplicate/spike/calibration).
- Target mean/SD: set manually per QC rule in Test Types → QC Acceptance
  Rules (`12-testtypes-ui.js`, `targetMean`/`targetSD` fields), or left blank
  to auto-calculate (sample mean/SD, n-1) from the accumulated QC points —
  see `resolveQcTarget()` in `15-qc-module.js`.
- Westgard subset implemented: 1-3s, 2-2s, R-4s (reject-level), 4-1s, 10x
  (warning-level). See `evaluateWestgard()`.
- `getQcStatusForMethod(testTypeId, testTypes, testRecords)` is the shared
  helper — used by both the QC Module tab and the Sample review/approval
  banner in `SampleDetail` (`21-sample-ui.js`) so both stay in sync.

## Sub-Batch Workflow (replaces the earlier Test Run tab)

For methods where 15-20+ field samples run together, sharing one QC check.
Three steps, deliberately in three different places since different people
do them at different times:

1. **Create** — Samples tab → "Sub-Batches" sub-tab. Pick a Test Type, check
   off pending samples (any registration batch — mixing is fine, see below),
   optionally assign a tester. Saved as a `subBatch` record (`16-sub-batch.js`),
   status `"pending"`.
2. **Test** — Add Test Record → "OR Select Sub-Batch" dropdown (instead of a
   single Sample). Locks the Test Type, prefills No. of Field Samples from
   the member count (drives the existing chemical/gas deduction — unchanged
   logic), shows a per-sample result-entry grid, and the existing QC section
   (now shared across the whole sub-batch). On save: **one** test record is
   created holding `memberSampleIds` + `memberResults` (per-sample computed
   values), inventory is deducted exactly like a normal single-sample record,
   every member sample gets the record linked into `linkedTestRecordIds`, and
   the sub-batch flips to status `"tested"`.
3. **Report** — `getSampleResultForTest(sample, testTypeId, testRecords)` in
   `16-sub-batch.js` is the shared lookup: works whether a sample's result
   came from a plain single Add Test Record entry or from inside a
   sub-batch's `memberResults`. Used by the QC Module, the Sample review
   banner, and the Report Generator — so none of them care how a sample was
   actually tested.

**Mixing registration batches in one sub-batch is intentional and safe** — a
sample's own `batchRef` (set at registration) never changes regardless of
which sub-batch tested it. Reporting is done by filtering Samples on
`batchRef` (see Report Generator's "Quick-select by original receiving
batch" dropdown), completely independent of testing groupings.

Test Type → QC Acceptance Rules → "QC Frequency" gives a soft warning when
creating/using a sub-batch larger than the configured frequency without a
QC check attached.

Scope note: chemical/gas inventory deduction for sub-batches reuses the
exact same logic Add Test Record already uses for single samples (driven by
No. of Field Samples) — no separate/duplicate inventory code was written.

### Per-parameter eligibility (fixed)

A sample with several `requestedTests` does **not** move through them in
lockstep — one parameter can be Done while another is still fully Pending.
Eligibility ("does this sample still need testing for parameter X?") is
computed per **(sample, testTypeId)** pair via `pendingTestTypeIdsForSample()`
/ `testStatusForSample()` in `16-sub-batch.js`, never off the sample's single
overall `status` field. A sample keeps showing up in the Sub-Batch Builder
and the Add Test Record sample picker for every parameter it still needs,
independently, until a test record is actually saved for that specific
parameter (or it's queued into a pending sub-batch for that parameter).
Sample Detail's "Requested Tests" chips show each parameter's own state
(Done / Queued / Pending / On Hold) for the same reason.

Previously the sample's single `status` field (and a same-sample-any-
pending-sub-batch check that didn't look at *which* test type) was used for
this, which could wrongly hide a sample from parameters it still needed
once one other parameter moved forward, or wrongly block re-offering a
parameter that was actually still open.

### Auto status propagation + per-parameter stage (Phase 2)

Previously nothing ever moved `Sample.status` forward automatically — every
transition (including "all results are in") needed a manual click in
Sample Detail, even when the underlying work was already done. Now, every
time a test record is saved (single-sample or via a Sub-Batch), the app
checks whether *every* parameter the sample requested now has a result; if
so and the sample is still `in_progress`, it auto-advances to
`results_entered` via the normal `transitionSample()` state machine (so it
still respects the allowed-transitions table and still logs a custody
event) — see the save handler in `13-testrecords-ui.js`.

Review / Approve / Release remain single decisions made on the whole
Sample (unchanged, same buttons in Sample Detail) — turning those into
fully independent per-parameter actions would mean rebuilding the
Review/Approve UI itself around Sub-Batches instead of Samples, which is a
bigger, separate change from what's implemented here. What IS fully
per-parameter now is *visibility*: `testStageForSample()` in
`16-sub-batch.js` reports each requested parameter's real position —
Pending / In Progress / Result Entered / Under Review / Approved /
Released / On Hold — shown on the Sample Detail "Requested Tests" chips.
An un-resulted parameter never shows further along than "Pending"/"In
Progress" even if the sample itself has been pushed further, since a
result can't be reviewed/approved before it exists.

### Per-parameter Review / Approve / Release (Phase 3)

`requestedTests[].status` is now the real, stored source of truth for each
parameter's pipeline position (`pending → in_progress → results_entered →
under_review → approved → released`), not just a display-time derivation.
`Sample.status` is a **rollup** of these — the least-advanced ("bottleneck")
parameter decides where the sample as a whole shows up — computed by
`rollupSampleStatus()` / applied via `setRequestedTestStatus()` in
`20-sample-model.js`, every time any parameter's status changes.

**Sub-Batch review** (`21-sample-ui.js`, `SubBatchBuilder`) — a "tested"
Sub-Batch can be **Marked Reviewed** (bulk-moves that one parameter,
`results_entered → under_review`, for all its member samples) or **Returned
to Analyst** (back to `in_progress`, with an optional note; the Sub-Batch
itself goes back to `pending` so it naturally reappears in Add Test
Record's picker — the previous test record stays linked, a resubmit adds a
new one on top rather than overwriting it). This is the doc's "Review is
performed at batch level" — except the "batch" it now correctly means is
the Sub-Batch (one parameter), not the whole sample.

**Final Approval / Release stay exactly where they were** — the existing
e-signature/attestation flow (`addApproval()` in `20-sample-model.js`,
triggered from Sample Detail's `SignatureCapture`) and `releaseResults()`.
Nothing routes around that on purpose: it's a real compliance gate
(typed name + attestation), so Sub-Batch review deliberately stops one
step short of it. What changed is that both functions now also call
`syncRequestedTestsToStage()` after a signed decision, bringing every
parameter waiting at the stage just cleared up to match — so the signed
whole-sample decision and the per-parameter record can never disagree.
Because the rollup only lets `Sample.status` reach `results_entered` /
`under_review` once *every* requested parameter has independently reached
that stage, the signature step was always effectively deciding for all of
them at once anyway — this just makes that explicit in the data.

The old generic "Move Status" buttons in Sample Detail no longer offer
`results_entered` / `under_review` / `approved` / `released` as manual
targets (those are exclusively reached through the mechanisms above now);
they still handle genuine whole-sample custody moves — `on_hold`,
`cancelled`, `rejected`, and starting testing (`assigned → in_progress`) —
which have no automated equivalent.

**Release** (`17-report-generator.js`) — generating a report marks
`released` on exactly the (sample, testType) pairs actually included,
*if* they were already `approved`. Per the workflow doc, a report should
only be generated after approval — this is enforced as a **soft** gate
(warns and lists which parameters weren't approved yet, but still lets the
report print) rather than a hard block, since not every lab necessarily
runs every parameter through the formal review step.

A pre-Phase-3 sample (`requestedTests[]` with no `status` field yet) is
backfilled once, on load, by `backfillRequestedTestStatuses()` in
`16-sub-batch.js` — same idempotent-migration pattern as the Reference
backfill in Phase 1.

### Sample Detail as the single source of truth (observation #4)

Add Test Record and the Report Generator used to each show their own
ad-hoc slice of a sample (a bare sentence of text, independently
formatted). Sample Detail (in the Samples tab) is the real record — full
registration info, Reference, custody log, and every requested parameter's
own status. Two small, shared pieces now connect everything to it instead
of duplicating it:

- **`SampleMiniCard`** (`21-sample-ui.js`) — a shared summary component
  (code, client, site, Reference, per-parameter status chips) that Add
  Test Record renders instead of its own one-line summary. Report
  Generator's sample picker gets a lighter "↗" deep-link per row instead
  (a full card per row would be too heavy for a 50-sample checklist).
- **`goToSample(id)`** (`99-app.js`) — switches to the Samples tab and
  opens that sample's Sample Detail directly. `focusSampleId` is lifted
  out of `SamplesTab` into the app root so any tab can drive it (`SamplesTab`
  still falls back to its own internal state if used without these props,
  so it stays usable standalone). Wired into Add Test Record's sample/
  sub-batch pickers and the Report Generator's sample list.

QC Module doesn't reference individual samples directly, so it didn't need
this.

### Bug fix: Sub-Batch Builder crash on every create/edit/reset

The Phase 1 rename of `selectedBatchRefs` → `selectedReferenceIds` missed
three call sites inside `resetForm()` / `startEdit()` / the auto-batch
helper in `21-sample-ui.js`, left calling a setter that no longer existed.
This threw on every single Sub-Batch creation, right after the real work
(creating the Sub-Batch, marking members `in_progress`) had already
happened — so the data was fine, but the form never properly reset,
producing exactly the "samples still show up again" symptom. Fixed by
restoring the correct setter name at all three sites.

### Selection Mode (Individual / Batch / Sub-Batch)

Both **Add Test Record** (`13-testrecords-ui.js`) and the **Report
Generator** (`17-report-generator.js`) now lead with an explicit "How are
you selecting samples?" dropdown instead of two pickers shown side by side
(Add Test Record) or a single always-on checkbox list (Report Generator):

- **Individual Sample(s)** — unchanged behavior, pick one directly.
- **Sub-Batch** — pick an existing Sub-Batch; its member list and locked
  Test Type are shown.
- **Batch (by Reference)** — pick a Reference; every sample under it that
  still needs the chosen parameter is listed. In Add Test Record, clicking
  "Use This Batch" **creates a real Sub-Batch behind the scenes** for that
  Reference + parameter combination and switches into normal Sub-Batch
  flow — no separate/duplicate code path for results entry, review, or
  reporting. In the Report Generator, picking a Reference just selects its
  samples (and auto-fills Ref Memo No/Date from it); picking a Sub-Batch
  selects its members **and** locks the report's Test Type column to that
  Sub-Batch's parameter (the normal "auto-pick every test type these
  samples have ever requested" effect is suppressed in this mode so it
  doesn't widen the column selection back out).

Once a sample/Sub-Batch is selected, the old "sample IDs in a bad list"
display is gone — Add Test Record shows a proper card/table (client, site,
Reference, per-parameter stage — the same `SampleMiniCard` from the single-
source-of-truth work, or a compact member table for Sub-Batch mode) instead
of raw codes.

### Test Records list — batch/sub-batch identity + inline review

Each record row now carries a clear **Sub-Batch: `<label>`** or
**Individual: `<sample code>`** badge (previously just the test name +
date — no way to tell what the record actually covered without opening
it). Expanding a record shows each member's client, site, Reference, and
live per-parameter stage — not just a sample code and a result number.
**Mark Reviewed** / **Return to Analyst** are available directly here too
(reusing the shared `reviewSubBatchApprove()` / `reviewSubBatchReturn()`
functions from `16-sub-batch.js` — the same ones the Sub-Batch Builder's
review queue uses, so there's one implementation, not two that could
drift), plus the equivalent single-parameter version for standalone
(non-Sub-Batch) records. This was the point raised: review shouldn't
require leaving the screen where you're already looking at the readings.

### Report Generator: hard gate on missing results

Previously report generation only soft-warned about parameters that
weren't `approved` yet. Now, before generation is even attempted, every
selected (sample, test) column that has **no result at all** (`pending` or
`in_progress`) blocks generation entirely, listing which ones are missing
— per the workflow doc, a report can't be produced from parameters that
haven't been tested yet. The softer "not approved yet, so not marked
Released" warning still applies afterward for columns that do have a
result but haven't cleared final approval.

### Bug fix: Bulk Upload Results (into an existing record) never updated sample status

`RecordBulkUploadModal` (Test Records → row → "Bulk upload results from
Excel") fills in result values for an already-created record's member
samples — a separate path from the normal Add Test Record save, and it
was only ever writing to `testRecords`. It never called
`setRequestedTestStatus()`, so a sample whose result got filled in this
way stayed stuck at `Pending`/`In Progress` on Sample Detail even though
the actual value was sitting right there in the record — exactly the "I
uploaded a result and the sample still shows manual/pending" symptom.
Fixed in `applyBulkResults()` (`13-testrecords-ui.js`): any member that
now has a non-null value gets its parameter moved to `results_entered`,
same as every other results-entry path, with the rollup keeping
`Sample.status` in sync automatically.

(There's also a `bulk-result-import` badge referenced in the row display
for a "create whole new records from an Excel sheet" style import — that
`source` value is never actually set anywhere in the code, so it's inert/
vestigial, not a live path that needed the same fix.)

### Sample Detail now shows actual result values, not just a status count

Previously the "Requested Tests" section only showed a status chip per
parameter, plus a bare "Linked test records: N (see Test Records tab)"
line — the actual measured values were never shown on the sample's own
page, only in Test Records. Each parameter row now also shows its real
value(s) and the record date once results exist, via the existing
`getSampleResultForTest()` helper (`16-sub-batch.js`) — no reason to make
someone leave the single source of truth to see the number that's
supposedly already "entered."

### Final Approve — now available at Batch, Sub-Batch, and Individual level

Previously, once a parameter reached `under_review`, the only way to
actually approve it was one sample at a time via Sample Detail's
signature flow — there was no bulk option. `bulkDecideParameter()`
(`20-sample-model.js`) is the same signature-gated decision as
`addApproval()`, just applicable to many (sample, testType) pairs in one
signed action:

- **Sub-Batch level** — a "reviewed" Sub-Batch gets a **Final Approve**
  button (Sub-Batch Builder's queue, and mirrored in Test Records) that
  opens the same `SignatureCapture` panel used everywhere else; one
  signature approves every member still `under_review` for that Sub-
  Batch's parameter. `bulkApproveSubBatch()` (`16-sub-batch.js`) is the
  shared implementation both places call.
- **Batch (Reference) level** — a new "Batch Approve (by Reference)" card
  in the Sub-Batch Builder tab: pick a Reference, see every (sample,
  parameter) pair under it that's ready for final approval (could span
  several different parameters/Sub-Batches at once), one signature
  approves all of them — grouped by parameter under the hood since the
  underlying decision is still per-parameter, but the person approving
  only signs once.
- **Individual level** — Test Records' expanded view for a standalone
  (non-Sub-Batch) record now also gets a **Final Approve** button once
  that parameter reaches `under_review`, instead of only being reachable
  via Sample Detail.

All three ultimately call the same `bulkDecideParameter()` /
`setRequestedTestStatus()` machinery, so the rollup, Sub-Batch status
badges, and audit trail (`sample.approvals[]`) stay consistent regardless
of which level someone approved from.

## Custom Report Generator (added)

- Reports tab → "Official Report" group → "Custom Report Generator".
- Three layers of data, each set in a different place:
  - **Lab Identity** (Settings → "Lab Identity" button, `01-data-service.js`):
    office letterhead — set once per lab, reused on every report.
  - **Per-Sample fields** (Sample registration / bulk manifest,
    `20-sample-model.js` / `21-sample-ui.js`): District, Upazila, Union,
    Village, Caretaker Name, Sample Source — captured once per sample.
  - **Per-Report memo fields** (entered in the generator itself): Memo No,
    Ref Memo No/Date, Date of Testing, Receiving Date, etc. — different for
    every report/memo.
- `buildReportHtml()` in `17-report-generator.js` is a pure function (no
  React) that assembles the full printable HTML; `printOfficialReport()`
  opens it in a new window and calls `window.print()`, the same pattern
  `printLabel()` in `10-inventory-logic.js` already used for bottle labels.
- Step 1 has a "Quick-select by original receiving batch" dropdown — one
  click selects every sample sharing a `batchRef`, regardless of which
  sub-batch(es) actually tested them.

## Manual Batch Registration

Samples tab → "Register Batch" (next to "Register New Sample"): enter
shared info once (client, matrix, district/upazila/union, dates, requested
tests), then add repeatable rows for only what differs per sample
(Village/Ward, Caretaker Name, Sample Source). Creates one individual
Sample per row, all sharing a `batchRef`. Alternative to the Excel manifest
upload for smaller batches typed directly in the browser.


### Bug fix: Sample.status stuck at "Registered" forever once testing started

The rollup only applied once `Sample.status` was already `assigned` or
later (`SAMPLE_ROLLUP_ELIGIBLE`) — but nothing actually requires a sample
to be manually moved through Received/Assigned before it can be queued
into a Sub-Batch (Phase 1's eligibility check only looks at on_hold/
rejected/cancelled). So a sample could go straight from `registered` into
full testing/review at the parameter level, while the rollup guard kept
ignoring it because `registered` wasn't in the eligible list — leaving it
displaying "Registered" forever, no matter how far its parameters actually
progressed. Fixed by broadening `SAMPLE_ROLLUP_ELIGIBLE` to include
`registered` and `received` too (`20-sample-model.js`) — the rollup is
only ever invoked when a parameter's status actually changes, so this
doesn't cause any premature jumps for samples with no testing activity
yet; it just lets the rollup catch up from wherever the sample actually
is instead of only from `assigned` onward.

### Sample Detail now has its own per-parameter Final Approve

The whole-sample signature flow in Sample Detail only ever appears once
`Sample.status` reaches `under_review` — which (correctly) requires every
one of a sample's parameters to have independently reached that stage
first. If only some parameters were ready, Sample Detail showed no way to
approve anything at all, even though the Sub-Batch/Individual-record
Final Approve existed elsewhere (Sub-Batch Builder, Test Records) — not
the first place someone looking at "my sample" would think to check.
Each Requested Test row in Sample Detail now gets its own **Final
Approve** button once that specific parameter reaches `under_review`,
using the same `bulkDecideParameter()` / signature panel as everywhere
else — so approving one specific parameter no longer requires waiting for
every other parameter on the sample to catch up first.

### Report tab reorganized into two groups

The Reports browse menu is now exactly two groups, as requested:
- **Report & Analytics** — every existing analytics page (previously
  spread across Overview/Operations/Inventory/Equipment/Trends & Forecast)
  folded into one group.
- **Custom Report** — three pages: **Multiple Sample Report** (the
  existing Custom Report Generator, unchanged, just relabeled/relocated),
  **Single Sample Report** (the same generator with `forceMode="individual"`
  — hides the selection-mode dropdown and makes picking a sample replace
  the selection instead of adding to it, so it behaves like a proper
  single-sample tool instead of a multi-select one locked to "individual"
  mode), and **Monthly Progress Report** — genuinely new, not built yet.
  It's an honest placeholder (`MonthlyProgressReportPage` in
  `14c-analytics-pages-2.js`) rather than something half-working — tell me
  what fields/layout you want (likely a month-by-month summary of
  registered/tested/approved/released counts) and I'll build it.


## Latest round: Release at 3 levels, form field additions, Client Type

- **Release** now mirrors Approve — available at **Individual** (Sample
  Detail per-parameter, Test Records individual record), **Sub-Batch**
  (Sub-Batch Builder + Test Records), and **Batch (Reference)** level (new
  "Batch Release (by Reference)" card in Sub-Batch Builder). Same pattern
  as approve: `bulkReleaseParameter()` in `20-sample-model.js`,
  `bulkReleaseSubBatch()` in `16-sub-batch.js`.
- Fixed: **Batch Approve (by Reference)** wasn't showing the actual test
  result value for each pending pair — a reviewer was approving blind.
  Now shows it, same as the Sub-Batch review views.
- **Registration form fields** now match the DPHE-LIMS v2 spec: added
  Father's/Husband's Name, Latitude, Longitude, and a Type of Water Point
  dropdown (`WATER_POINT_TYPES` in `21-sample-ui.js`) to both the
  registration rows and Sample Detail's edit view. Labels renamed to
  match ("Customer Name", "Sample Type", "Location / Address").
- **Client Type** dropdown expanded from 3 to the 5 requested options —
  DPHE, Private Organization, Other Government Institution, Walk-in
  Customer, Others (`REFERENCE_SOURCE_TYPES` in `19-reference-model.js`).
  Reference/Memo No., Organization Name, Letter Date, Contact Person,
  Contact Phone, and Notes are already collected for all of them via the
  existing ReferencePicker "+ New" flow (not conditionally hidden by
  type). Legacy `"institution"` data still resolves correctly (mapped to
  Private Organization).

### Still outstanding (not done this round — flagging honestly)

- **Bulk Upload → popup asking for Client Type + Reference details once**
  (instead of per-row / auto-created-per-refNo as it works today).
- **Test Record expand → proper HTML `<table>`** instead of the current
  flex-wrap row layout.
- **Reports tab restyled like the Inventory "Chemical" tab** (need to
  confirm exactly which visual pattern that refers to before building it).
- **Custom Report's sample picker → table layout** instead of the
  checkbox list.

These are all sizable pieces of their own — rather than rush them and risk
more mistakes, next turn I'll tackle them in this order unless told
otherwise.


## Round after: Reports pill nav, Bulk Upload popup, tables everywhere

- **Reports tab restyled to match Inventory's pill nav** — replaced the
  dropdown-per-group "Browse:" menu with the same rounded-full pill
  pattern as Equipment/Glassware/Chemicals/Gas
  (`ReportGroupPills`/`ReportPagePills` in `14c-analytics-pages-2.js`).
  Top level: two pills, **Report & Analytics** and **Custom Report**.
  Custom Report's 3 pages get their own pill row (small set, fits
  cleanly); Report & Analytics' 15 pages use a compact dropdown
  (`ReportPagePicker`) instead, since that many wouldn't fit as pills.
- **Bulk Upload now asks for Client Type/Reference once**, in the same
  modal where Requested Tests are picked (`ImportTestPickerModal` in
  `21-sample-ui.js`, extended with a `ReferencePicker`) — instead of the
  old per-row "auto-create a Reference from the BatchRef column" logic.
  One manifest sheet = one source, entered once, applied to every row.
- **Test Record expand → real `<table>`** instead of flex-wrap rows —
  columns are Sample / Client·Site / Reference / Stage / one column per
  result parameter (union across all members, so it stays a consistent
  table even when some samples aren't resulted yet).
- **Custom Report's sample picker → real `<table>`** too — checkbox /
  Sample / Client / Site·Village / Reference / view-link columns, click
  anywhere in the row to toggle selection.

All four of last round's "still outstanding" items are done now.


## Major registration redesign: Client Part / Sample Part, Tracking No.

- **Sub-tabs renamed**: "Samples" → **Samples Registration**, "Create and
  Edit Sub-Batches" → **Create Analytical Batch**.
- **Registration split into two clearly divided sections, one window, no
  popup**: **Client Part** (tracking info, filled once per registration/
  upload) and **Sample Part** (per-sample site details, one row per
  sample). The old ReferencePicker "+ New" separate-modal pattern is gone
  from the registration flow — `ClientPartFields` (`21-sample-ui.js`) is
  always inline now, in `BatchRegistrationForm`, the bulk-upload
  `ImportTestPickerModal`, and (for consistency) `ReferencePicker`'s own
  "+ New" modal too.
- **Client Part fields**: Client Source (DPHE / Other Govt. organization /
  Private organization / Walk-in-Client / Others — with a "please specify"
  box for Others), Client Type (ADP / Non-ADP / Calamity / Monitoring /
  VVIP / Others — same pattern), Ref/Memo No., Date, **Tracking No.**
  (required, validated unique across every Client entry via
  `isTrackingNoTaken()` in `19-reference-model.js`), Organization Name,
  Client Name, Client Contact No., Notes.
- **Sample Part fields** (per row): Customer Name, Father's/Husband's
  Name, District, City Corp./Pouroshova/Upazilla, Ward/Union, Site Name,
  Latitude, Longitude, Type of Water Point (Shallow TW/Deep TW/TSP/CTBT/
  RPWS/PSF/RWH/Other — updated `WATER_POINT_TYPES` list with a "please
  specify" box for Other). District/Upazilla/Union moved from
  batch-shared to per-row, since a bulk upload can span more than one
  administrative area.
- **Samples list**: group header (Reference/Client Part entry) now shows
  Tracking No. inline (folded into `referenceDisplayLabel()`) plus a
  Client Type badge; search box also matches Tracking No. and Ref No.
  Collapse/expand per batch group already existed — unchanged.
- `submitClientPart()` is the one shared validate-and-create function used
  everywhere a Client Part gets submitted, so the Tracking No. uniqueness
  rule and field mapping only live in one place.


## Register Samples modal — progressive-disclosure redesign

`BatchRegistrationForm` (`21-sample-ui.js`) rebuilt as an explicit two-step
flow instead of one long scroll with a nested Client Part box sitting on
top of cramped per-sample rows:

- **Step 1 — Client & Batch Info**: `ClientPartFields` (unchanged) plus
  Batch Defaults and Requested Tests, with nothing about individual
  samples visible yet. "Continue to Sample Details" runs a local,
  side-effect-free check (Tracking No. present, "please specify" fields,
  at least one test selected) — the real uniqueness check and Reference
  creation still happen exactly once, in `submitClientPart()` at final
  submit, same as before.
- Once confirmed, Step 1 collapses into a one-line **`ClientPartSummaryBar`**
  (client name · Tracking No. · Ref No. · requested tests) with an Edit
  link that jumps straight back — Sample Details gets the modal's full
  width instead of competing with the Client Part form for space.
- **Step 2 — Sample Details**: each sample is now its own **`SampleEntryCard`**
  (max 5 — `MAX_BATCH_ROWS` — with a note pointing to the bulk manifest
  upload beyond that) instead of a 4-line flex-wrap row of tiny inputs.
  Fields keep their existing names/order (Customer Name → Father's/
  Husband's Name → Site Name → District → Upazilla → Union → Lat/Long →
  Water Point Type), just laid out in a readable grid per card. Per-card
  **duplicate** (inserts a copy directly after that row, not just
  appended at the end) and **remove** actions replace the old "Duplicate
  Last Row" button.
- If final submit's `submitClientPart()` call does return an error (e.g.
  Tracking No. turned out to be taken), the form now automatically jumps
  back to Step 1 so the person lands on the field the error refers to,
  instead of showing the error while Step 2's sample cards are still on
  screen.
- Modal shell is bespoke (not the shared `Modal` component) so it can be
  wider (`max-width: 900px`) and have a sticky header (title + step
  indicator) and sticky footer (Cancel / Back / Continue-or-Register)
  that stay reachable regardless of how many sample cards are open —
  the shared `Modal` doesn't support either.
- New small presentational components, all local to `21-sample-ui.js`:
  `RegistrationStepper`, `ClientPartSummaryBar`, `SampleEntryCard`. No
  changes to `20-sample-model.js`, `19-reference-model.js`, or any other
  file — `onCreate(shared, validRows, reference)`'s shape is identical to
  before, so nothing downstream needed touching.


## Per-user overrides now cover Samples (Register / Assign / Review / Approve / Release)

The Module × Action permission matrix (Users → Permission Matrix, plus the
"Custom permissions for this user" editor on each user) previously covered
everything *except* the Sample Lifecycle's own register/assign/review/
approve/release permissions — those were still role-only
(`ROLE_PERMISSIONS` / `permissionsFor(role)` in `20-sample-model.js`), with
no way to grant or revoke one person's access without moving them to a
different role.

- **`permissionsFor()`** (`20-sample-model.js`) now takes
  `(permissionMatrix, session)` instead of a bare role string. Resolution
  order matches every other module: Administrator always full access →
  `session.overrides.samples.<action>` (per-user override) → the matrix's
  `permissionMatrix[role].samples.<action>` (role default) → a defensive
  fallback to the original `ROLE_PERMISSIONS` constant if a role is
  somehow missing a `samples` entry. All three call sites (`SamplesTab`
  and `SampleDetail` in `21-sample-ui.js`, `ResultsWorkflowTab` in
  `22-results-workflow-ui.js`) now take `permissionMatrix` as a prop,
  threaded down from `AppRoot`/`LabApp` in `99-app.js`.
- **`41-rbac-ui.js`**: added a `SAMPLE_MODULE` definition (Register /
  Assign / Enter Results / Review / Approve / Release — a different
  action set than the shared View/Create/Edit/Delete columns, so it's
  rendered as its own small grid rather than forced into
  `PERMISSION_MODULES`). Both `PermissionMatrixPanel` (role-level
  defaults) and `UserPermissionOverridesEditor` (per-user Allow/Deny/
  Inherit) now show this second grid, using the exact same
  `toggleCell()`/`cycle()`/`overrideCellState()` logic already used for
  every other module — no new interaction pattern to learn.
- **Migration**: `DEFAULT_PERMISSION_MATRIX[role].samples` is seeded from
  the existing `ROLE_PERMISSIONS` values, so behavior for every role is
  identical to before on a fresh install. For labs that already have a
  `permissionMatrix` saved in localStorage (from before this change, so
  missing the `samples` key entirely), `backfillSamplePermissions()` fills
  it in from the same `ROLE_PERMISSIONS` defaults the first time the app
  loads after updating — a no-op if it's already been through this once,
  same idempotent-migration pattern used elsewhere in this app.
- Verified end-to-end: created a Technician user with an explicit
  per-user "Approve" override — Results Workflow correctly shows them the
  "Awaiting Approval" queue (which a stock Technician never sees), while
  Review/Release stayed hidden since those weren't overridden.


## 2026-08-09 — RBAC enforcement audit: buttons that ignored permissions entirely

Reported bug: turning a role's (or a per-user override's) edit/delete off
for a module had no effect on several screens — the button still worked.
Root cause was **not** in permission resolution (`can()` /
`permissionsFor()` and their override logic were already correct — see the
previous section's migration work) but in UI code that never called those
functions at all. A permission can't do anything if nothing checks it.

**Confirmed gaps, closed this round:**

- **Inventory** (`11-inventory-ui.js`) — top-level Chemical/Glassware/
  Equipment/Gas add/edit/delete were already gated, but everything nested
  one level down was not: chemical **batch** edit/delete, glassware
  **move actions** (To Analysis Room / To Store / Mark Broken — these had
  no gate at all, not even a hidden one), equipment **history event**
  edit/delete, and gas **cylinder** add/edit/delete/refill/mark-empty.
  Also the three **Import Data** buttons (Chemicals/Glassware/Equipment)
  and their `importChemicals`/`importGlassware`/`importEquipment`
  functions — completely ungated.
- **Test Configuration › Parameters** (`12a-parameters-ui.js`) — didn't
  even receive `session`/`permissionMatrix` as props from
  `TestConfigurationTab` (`12-testtypes-ui.js`), so Add/Edit/Delete
  Parameter ran unconditionally for every role. Now shares the
  `testTypes` module's permissions (Parameters lives inside Test
  Configuration; it has no RBAC bucket of its own).
- **Sub-Batches** (`21-sample-ui.js`, `SubBatchBuilder`) — same story:
  `permissionMatrix` wasn't threaded in from `SamplesTab`, so
  create/edit/delete and the tester-reassignment dropdown were wide open
  regardless of the `subBatches` module's settings.
- **Add Test Record** (`13-testrecords-ui.js`, `AddTestTab`) — had zero
  permission checks, and worse, was reachable even when its nav tab was
  hidden: `goToTestEntry()` (called from the Results Workflow "Upload
  Results" queue, `99-app.js`) does a direct `setTab("addTest")`, which
  bypasses the nav bar's own `can()` filter entirely since that filter
  only hides the *button*, not programmatic tab switches. Fixed by
  gating `handleSave` (covers both the create and the edit-via-row-Edit
  path, using `testRecords.create`/`testRecords.edit` respectively) and
  the **Upload Results (Excel)** bulk-fill button — the latter needed its
  own gate because otherwise a blocked person could still open the modal
  and fill the form from a spreadsheet; only the final Save was blocked,
  which reads as "it worked" even though nothing was persisted.
- **Archive** (`18-archive-ui.js`) Restore, **Reports**
  (`17-report-generator.js`) Generate & Print, **Sample** edit/delete and
  **Register/Import Sample** (`21-sample-ui.js`) — all previously gated
  correctly, converted to the new pattern below for consistency.

**The fix — two small shared helpers, not a rewrite of every screen:**

- **`permGate(matrix, session, moduleKey, action, notify, actionLabel)`**
  (`41-rbac-ui.js`, next to `can()`) — for the generic Module × Action
  matrix. Returns `{ allowed, visible, guard(handler) }`.
- **`sampleActionGate(perms, actionKey, session, notify, actionLabel)`**
  (`20-sample-model.js`, next to `permissionsFor()`) — same shape, built
  on the Sample Lifecycle's fine-grained `canRegister`/`canReview`/
  `canApprove`/`canRelease`/etc. booleans instead of the generic matrix.

Both encode the same rule, which is also this round's UX decision:

- **Guest** is meant to browse the whole app like an Administrator would —
  every button and every tab stays visible, nothing hidden, including
  ones it can't use. But `guard(handler)` only calls `handler` if
  `allowed` is actually true; otherwise it shows a toast ("Guest access
  can't … — this login is view-only for this action.") and does nothing.
  So `visible = allowed || role === "Guest"`, while the click itself
  always checks `allowed`, never `visible`.
- **Every other role** (Technician, Reviewer, QA Manager, or anyone with
  a tightened per-user override) keeps the pre-existing convention: a
  control it has no permission for is hidden entirely, same as it's
  always been in this app.

Applied `permGate`/`sampleActionGate` across Inventory (all of it, listed
above), Parameters, Test Types, Test Records (Edit/Archive/Delete/Add/
bulk-upload), Archive Restore, Reports Generate, Sub-Batches, Sample
edit/delete, Register/Import Sample, and — the biggest piece — **Results
Workflow** (`22-results-workflow-ui.js`): Upload Results / Awaiting
Review / Awaiting Approval / Approved-Release are now all visible tabs
for Guest (`stageDefs[].show` includes `|| isGuestUser`), with a single
`stageGate` computed once per tab in `ResultsWorkflowTab` and threaded
down through `ReviewQueue`/`ApproveQueue`/`ReleaseQueue` →
`StageQueueBody` → `FlatStageTable`/`BatchStageTable` → `StageRow` →
`RowHoldReturnActions`, gating Mark Reviewed, Final Approve/Reject
(single row and whole-batch signing), Release, Hold/Resume, Return to
Analyst, and reviewer-remark editing.

Also updated the **nav bar itself** (`99-app.js`): Guest now sees every
tab a `Guest`-role-appropriate person would expect, including ones whose
underlying action it can't perform (e.g. "Add Test Record", which needs
`testRecords.create`) — the page itself blocks the actual mutation, per
above. Users & Audit Log stay hidden from Guest specifically, since the
default permission matrix already denies Guest *view* access to those
two (a deliberate design choice, not a bug — see
`DEFAULT_PERMISSION_MATRIX.Guest` in `41-rbac-ui.js`).

Every hide-vs-block point also got a matching check inside the mutating
function itself (not just the `onClick`), e.g. `createGroup`,
`doDeleteSubBatch`, `handleSave`, `doBulkRelease`, `importChemicals` —
so a handler can never fire past its permission check even if something
somehow calls it directly instead of through the guarded button.

**Known boundary, not addressed:** the `references` RBAC module
(View/Create/Edit/Delete, defined in the Permission Matrix) has no
standalone screen to gate — References are only ever created implicitly
during Sample Registration, folded into that flow's own `samples`
permission. Nothing to fix here; noted so it isn't mistaken for a missed
spot later.


## 2026-08-09 — Audit Log coverage extended to Inventory, Sub-Batches, Parameters

The Audit Log viewer itself (`42-audit-log-ui.js` — search, filters, CSV
export, `auditLog.view` gating) was already fully built; the gap was in
*what gets written*. Before this round, `DataService.appendAudit()` was
only called from Sample state changes (automatically, via the central
`setSamples(updater, changedRecord)` wrapper in `99-app.js`), Test
Records, Test Types, and Users/Permission Matrix edits — so deleting a
chemical batch or a sub-batch left no trail at all, silently.

- Added `DataService.appendAudit()` calls at every mutation point covered
  by this round's `permGate()` audit above:
  **Inventory** (`11-inventory-ui.js`) — chemical create/edit/delete,
  batch add/edit/delete, glassware create/edit/delete/move (to Analysis
  Room / to Store / Mark Broken), equipment create/edit/delete + event
  log/edit/delete, gas create/edit/delete + cylinder add/edit/delete/
  refill/mark-empty, and the three bulk-import actions (one summary
  entry per import, e.g. "Imported 12 chemical batch row(s)…").
  **Sub-Batches** (`21-sample-ui.js`) — create/edit (`createGroup`) and
  delete (`doDeleteSubBatch`). **Parameters** (`12a-parameters-ui.js`) —
  create/edit (`handleSave`) and delete (`handleDelete`).
- Every new call uses the same field shape already established
  elsewhere: `{ entity, entityId, action, user: session.username,
  role: session.role, note }` — no new conventions.
- `AUDIT_ENTITY_OPTIONS` (`42-audit-log-ui.js`) extended with `chemical`,
  `glassware`, `equipment`, `gas`, `subBatch`, and `parameter` so the new
  entries are filterable, not just visible in an unfiltered dump. Updated
  the file's own header comment (it previously documented this exact gap
  as known-and-open) to reflect the closed state and list every
  write-site for future reference.

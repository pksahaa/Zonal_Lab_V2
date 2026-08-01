// ===== 22-results-workflow-ui.js =====
// ============================================================================
// RESULTS WORKFLOW — the ONE place "Upload results / Review / Approve /
// Release" happens now. Previously these were scattered across three spots:
//   1. Sample Detail (21-sample-ui.js) — per-parameter Final Approve/Release
//      buttons + the whole-sample signature panel.
//   2. Create Analytical Batch's Sub-Batch rows — inline Mark Reviewed /
//      Final Approve / Release buttons.
//   3. Create Analytical Batch's "Batch Actions" toolbar — Batch Approve /
//      Batch Release by Reference.
// All three are removed from those locations (Sample Detail now only shows
// read-only stage/value + a deep-link here; Create Analytical Batch is
// creation-only again) and consolidated into this tab, reached from Samples
// → "Results Workflow".
//
// IMPORTANT — no new decision logic lives here. Every action below calls the
// exact same functions that used to live in those three places
// (bulkDecideParameter / bulkReleaseParameter in 20-sample-model.js,
// setRequestedTestStatus for the un-signed review step) — this file is a UI
// consolidation only. Because those functions already take an arbitrary
// list of samples (not just a Sub-Batch's members), every queue below groups
// by (testTypeId) across ALL samples needing that step, regardless of
// whether they were tested via a Sub-Batch, Batch(Reference) mode, or a
// plain individual Add Test Record entry — one queue, one action, no matter
// how the result got entered.
//
// ROLE AWARENESS — a stage/queue is only rendered at all if the signed-in
// role is permissioned for it (permissionsFor() in 20-sample-model.js):
//   - Technician (the "Analyzer" role) → canEnterResults only → sees ONLY
//     "Pending Upload". Nothing else from this tab is even reachable.
//   - Reviewer → canReview only → sees ONLY "Awaiting Review".
//   - QA Manager / Administrator → canReview + canApprove + canRelease (and
//     canEnterResults for Administrator) → see every stage they're
//     permissioned for.
// This is enforced by hiding the pill + queue entirely, not just disabling
// a button, so a multi-role lab can hand this one screen to everyone and
// each person only ever sees their own piece of it.
// ============================================================================

const E = React.createElement;

// ---- shared grouping: every (sample, requestedTest) pair currently at
// `stage`, grouped by testTypeId. This is what makes the queues indifferent
// to Sub-Batch vs. individual vs. Batch(Reference) origin. ----
function groupSamplesByParamStage(samples, stage) {
  const map = {};
  (samples || []).forEach(sample => {
    (sample.requestedTests || []).forEach(rt => {
      if (rt.status !== stage) return;
      const key = rt.testTypeId;
      if (!map[key]) {
        map[key] = {
          testTypeId: rt.testTypeId,
          testTypeName: rt.testTypeName,
          samples: []
        };
      }
      map[key].samples.push(sample);
    });
  });
  return Object.values(map).sort((a, b) => (a.testTypeName || "").localeCompare(b.testTypeName || ""));
}

// ---- un-signed technical review step (results_entered -> under_review, or
// back to in_progress) — same as reviewSubBatchApprove/Return in
// 16-sub-batch.js used to do, just generalized to any sample list instead
// of requiring a Sub-Batch wrapper object. ----
function bulkMarkReviewed(sampleList, testTypeId, testTypeName, session, setSamples, notify) {
  let count = 0;
  sampleList.forEach(sample => {
    const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    if (!rt || rt.status !== "results_entered") return;
    const updated = setRequestedTestStatus(sample, testTypeId, "under_review", session);
    setSamples(prev => prev.map(s => s.id === sample.id ? updated : s));
    count++;
  });
  notify?.(`${count} sample(s) marked reviewed for ${testTypeName} — ready for final approval.`, "ok");
}
function bulkReturnToAnalystFromReview(sampleList, testTypeId, testTypeName, session, setSamples, notify, note) {
  let count = 0;
  const finalNote = (note || "").trim() || `Returned to analyst for ${testTypeName}.`;
  sampleList.forEach(sample => {
    const rt = (sample.requestedTests || []).find(r => r.testTypeId === testTypeId);
    if (!rt || !["results_entered", "under_review"].includes(rt.status)) return;
    const updated = setRequestedTestStatus(sample, testTypeId, "in_progress", session, finalNote);
    setSamples(prev => prev.map(s => s.id === sample.id ? updated : s));
    count++;
  });
  notify?.(`${count} sample(s) returned to analyst for ${testTypeName}.`, "warn");
}

// ---- small presentational bits ----
// showSystemRemark: only "Awaiting Review" and "Awaiting Approval" pass this
// (see ReviewQueue / ApproveQueue below) — Pending Upload and Release stay
// exactly as they were.
function StageResultRow({ sample, testTypeId, testRecords, testTypes, parameters, references, goToSample, showSystemRemark, setSamples }) {
  const resultInfo = getSampleResultForTest(sample, testTypeId, testRecords);
  const ref = sample.referenceId ? findReferenceById(references, sample.referenceId) : null;
  const evaluated = showSystemRemark
    ? evaluateSampleResultsForTest(sample, testTypeId, testTypes, parameters, testRecords)
    : [];
  function handleManualRemarkChange(text) {
    const updated = setManualRemarkOnSample(sample, testTypeId, text);
    setSamples?.(prev => prev.map(s => s.id === sample.id ? updated : s), updated);
  }
  return E("tr", { key: sample.id, className: "border-t", style: { borderColor: C.border } },
    E("td", { className: "px-3 py-1.5" },
      E("button", {
        className: "text-xs font-semibold underline",
        style: { color: C.teal },
        onClick: () => goToSample?.(sample.id)
      }, sample.sampleCode)
    ),
    E("td", { className: "px-3 py-1.5 text-xs", style: { color: C.muted } }, sample.clientName || "—"),
    E("td", { className: "px-3 py-1.5 text-xs", style: { color: C.muted } }, ref ? referenceDisplayLabel(ref) : "—"),
    E("td", { className: "px-3 py-1.5 text-xs", style: { color: C.ink } },
      resultInfo && resultInfo.results && resultInfo.results.length
        ? resultInfo.results.filter(r => r.value != null).map(r => `${r.name}: ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ""}`).join(", ") || "—"
        : "—"
    ),
    showSystemRemark && E("td", { className: "px-3 py-1.5" },
      E(SystemRemarkCell, {
        evaluated,
        manualRemark: getManualRemark(sample, testTypeId),
        onManualRemarkChange: handleManualRemarkChange,
        editable: !!setSamples
      })
    )
  );
}

function ParamGroupCard({ title, subtitle, group, testRecords, testTypes, parameters, references, goToSample, qcWarn, actions, showSystemRemark, setSamples }) {
  const headers = showSystemRemark ? ["Sample", "Client", "Reference", "Result", "System Remark"] : ["Sample", "Client", "Reference", "Result"];
  return E(SectionCard, { title, subtitle: subtitle, className: "mb-3" },
    qcWarn && E("div", {
      className: "text-[11px] px-2 py-1.5 rounded mb-2 flex items-center gap-1.5",
      style: { background: C.warnBg, color: C.warn }
    }, E(Icon, { name: "warning", size: 12 }), qcWarn),
    E("div", { className: "overflow-x-auto" },
      E("table", { className: "w-full text-left" },
        E("thead", null,
          E("tr", null,
            headers.map(h =>
              E("th", { key: h, className: "px-3 py-1.5 text-[11px] font-semibold", style: { color: C.muted } }, h)
            )
          )
        ),
        E("tbody", null, group.samples.map(sample =>
          E(StageResultRow, {
            key: sample.id, sample, testTypeId: group.testTypeId, testRecords, testTypes, parameters, references, goToSample,
            showSystemRemark, setSamples
          })
        ))
      )
    ),
    E("div", { className: "flex flex-wrap gap-2 mt-2" }, actions)
  );
}

// ---- Pending Upload queue: Sub-Batches ready to be tested, plus a note
// about individually-registered samples still needing entry. Actual result
// entry still happens in Add Test Record (13-testrecords-ui.js) — this
// queue's job is to surface what's waiting and jump straight into it
// preselected, not to reimplement the entry form. ----
function PendingUploadQueue({ subBatches, samples, testRecords, testTypes, references, goToTestEntry }) {
  const pendingSubBatches = (subBatches || []).filter(sb => sb.status === "pending");
  const individualPendingCount = (samples || []).filter(s =>
    pendingTestTypeIdsForSample(s, testRecords, subBatches).length > 0
  ).length;
  return E("div", null,
    E(SectionCard, {
      title: "Analytical Batches Ready for Testing",
      subtitle: "Created in Create Analytical Batch — pick one to enter results.",
      className: "mb-3"
    },
      pendingSubBatches.length === 0
        ? E("div", { className: "text-xs", style: { color: C.muted } }, "Nothing queued right now.")
        : E("div", { className: "space-y-2" }, pendingSubBatches.map(sb =>
            E("div", {
              key: sb.id,
              className: "flex items-center justify-between p-2 rounded",
              style: { border: `1px solid ${C.border}` }
            },
              E("div", null,
                E("div", { className: "text-xs font-semibold", style: { color: C.ink } }, sb.label),
                E("div", { className: "text-[11px]", style: { color: C.muted } },
                  sb.testTypeName, " · ", (sb.memberSampleIds || []).length, " sample(s)",
                  sb.assignedTester ? ` · Assigned: ${sb.assignedTester}` : ""
                ),
                (() => {
                  const firstSample = (samples || []).find(s => (sb.memberSampleIds || []).includes(s.id));
                  const ref = firstSample?.referenceId ? findReferenceById(references, firstSample.referenceId) : null;
                  return E("div", {
                    className: "text-[11px] px-1.5 py-0.5 rounded font-mono mt-1 inline-block",
                    style: { background: C.bg, color: C.muted },
                    title: "Date | Test Name | Ref / Memo No. | Tracking No."
                  }, formatBatchIdentifier(todayStr(), sb.testTypeName, ref?.refNo, ref?.trackingNo));
                })()
              ),
              E("div", { className: "flex items-center gap-2" },
                E(Button, { size: "sm", onClick: () => goToTestEntry?.(sb.id) },
                  E(Icon, { name: "upload", size: 12 }), "Enter Individual Result"
                ),
                E(Button, { size: "sm", variant: "outline", onClick: () => goToTestEntry?.(sb.id) },
                  E(Icon, { name: "download", size: 12 }), "Bulk Upload"
                )
              )
            )
          ))
    ),
    individualPendingCount > 0 && E(SectionCard, {
      title: "Individually-Pending Samples",
      subtitle: `${individualPendingCount} sample(s) still need at least one parameter tested and aren't in a batch yet.`
    },
      E(Button, { size: "sm", variant: "outline", onClick: () => goToTestEntry?.(null) },
        E(Icon, { name: "flask", size: 12 }), "Open Add Test Record"
      )
    )
  );
}

function ReviewQueue({ samples, setSamples, testRecords, testTypes, parameters, references, session, notify, goToSample }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "results_entered"), [samples]);
  const [returningKey, setReturningKey] = React.useState(null);
  const [returnNote, setReturnNote] = React.useState("");
  if (!groups.length) return E("div", { className: "text-xs p-3", style: { color: C.muted } }, "No parameters awaiting review right now.");
  return E("div", null, groups.map(group => {
    const qc = getQcStatusForMethod(group.testTypeId, testTypes, testRecords);
    const qcWarn = qc.hasReject ? "Westgard violation on recent QC runs for this method — check QC Module before reviewing." :
      qc.hasWarning ? "QC warning pattern on recent runs for this method — check QC Module before reviewing." : null;
    const isReturning = returningKey === group.testTypeId;
    return E(ParamGroupCard, {
      key: group.testTypeId,
      title: `${group.testTypeName} — ${group.samples.length} awaiting review`,
      subtitle: "Technical review — moves results to Awaiting Approval.",
      group, testRecords, testTypes, parameters, references, goToSample, qcWarn,
      showSystemRemark: true, setSamples,
      actions: [
        E(Button, {
          key: "mr", size: "sm",
          onClick: () => bulkMarkReviewed(group.samples, group.testTypeId, group.testTypeName, session, setSamples, notify)
        }, E(Icon, { name: "check", size: 12 }), "Mark Reviewed"),
        E(Button, {
          key: "rt", size: "sm", variant: "outline",
          onClick: () => setReturningKey(isReturning ? null : group.testTypeId)
        }, "Return to Analyst"),
        isReturning && E("div", { key: "note", className: "w-full flex gap-2 mt-1" },
          E("input", {
            className: "border rounded px-2 py-1 text-xs flex-1",
            style: { borderColor: C.border },
            placeholder: "Reason for returning (optional)",
            value: returnNote,
            onChange: e => setReturnNote(e.target.value)
          }),
          E(Button, {
            size: "sm", variant: "outline",
            onClick: () => {
              bulkReturnToAnalystFromReview(group.samples, group.testTypeId, group.testTypeName, session, setSamples, notify, returnNote);
              setReturningKey(null);
              setReturnNote("");
            }
          }, "Confirm Return")
        )
      ].filter(Boolean)
    });
  }));
}

function ApproveQueue({ samples, setSamples, testRecords, testTypes, parameters, references, session, notify, goToSample }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "under_review"), [samples]);
  const [signingKey, setSigningKey] = React.useState(null);
  if (!groups.length) return E("div", { className: "text-xs p-3", style: { color: C.muted } }, "No parameters awaiting final approval right now.");
  return E("div", null, groups.map(group => {
    const isSigning = signingKey === group.testTypeId;
    return E("div", { key: group.testTypeId },
      E(ParamGroupCard, {
        title: `${group.testTypeName} — ${group.samples.length} awaiting final approval`,
        subtitle: "Signature-gated final decision.",
        group, testRecords, testTypes, parameters, references, goToSample,
        showSystemRemark: true, setSamples,
        actions: [
          E(Button, {
            key: "fa", size: "sm",
            onClick: () => setSigningKey(isSigning ? null : group.testTypeId)
          }, E(Icon, { name: "check", size: 12 }), "Final Approve / Reject")
        ]
      }),
      isSigning && E(SignatureCapture, {
        key: "sig",
        user: session,
        label: `Final Approval — ${group.testTypeName} (${group.samples.length} sample(s))`,
        onConfirm: payload => {
          try {
            const result = bulkDecideParameter(group.samples, group.testTypeId, group.testTypeName, payload, session);
            result.updated.forEach(updated => {
              setSamples(prev => prev.map(s => s.id === updated.id ? updated : s));
            });
            notify?.(
              payload.decision === "approved"
                ? `${result.updated.length} sample(s) approved for ${group.testTypeName}${result.skipped ? ` (${result.skipped} skipped)` : ""}.`
                : `${result.updated.length} sample(s) sent back to analyst for ${group.testTypeName}.`,
              payload.decision === "approved" ? "ok" : "warn"
            );
          } catch (e) {
            notify?.(e.message, "warn");
          }
          setSigningKey(null);
        }
      })
    );
  }));
}

function ReleaseQueue({ samples, setSamples, testRecords, testTypes, references, session, notify, goToSample }) {
  const groups = React.useMemo(() => groupSamplesByParamStage(samples, "approved"), [samples]);
  if (!groups.length) return E("div", { className: "text-xs p-3", style: { color: C.muted } }, "Nothing approved and awaiting release right now.");
  return E("div", null, groups.map(group =>
    E(ParamGroupCard, {
      key: group.testTypeId,
      title: `${group.testTypeName} — ${group.samples.length} approved`,
      subtitle: "Not signature-gated — same as the single-sample Release action.",
      group, testRecords, testTypes, references, goToSample,
      actions: [
        E(Button, {
          key: "rel", size: "sm",
          onClick: () => {
            const result = bulkReleaseParameter(group.samples, group.testTypeId, group.testTypeName, session);
            result.updated.forEach(updated => {
              setSamples(prev => prev.map(s => s.id === updated.id ? updated : s));
            });
            notify?.(`${result.updated.length} sample(s) released for ${group.testTypeName}.`, "ok");
          }
        }, E(Icon, { name: "printer", size: 12 }), "Release")
      ]
    })
  ));
}

// ---- main tab ----
function ResultsWorkflowTab({
  samples,
  setSamples,
  subBatches,
  setSubBatches,
  references,
  testTypes,
  testRecords,
  parameters,
  session,
  notify,
  goToTestEntry,
  goToSample
}) {
  const perms = permissionsFor(session.role);
  const stageDefs = [
    { k: "upload", label: "Upload Results", icon: "upload", show: !!perms.canEnterResults },
    { k: "review", label: "Awaiting Review", icon: "search", show: !!perms.canReview },
    { k: "approve", label: "Awaiting Approval", icon: "check", show: !!perms.canApprove },
    { k: "release", label: "Approved — Release", icon: "printer", show: !!perms.canRelease }
  ];
  const visible = stageDefs.filter(s => s.show);
  const [active, setActive] = React.useState(visible[0]?.k || null);
  React.useEffect(() => {
    if (!visible.some(s => s.k === active)) setActive(visible[0]?.k || null);
    // eslint-disable-next-line
  }, [session.role]);

  if (!visible.length) {
    return E("div", { className: "text-sm p-6 text-center", style: { color: C.muted } },
      "Your role (", session.role, ") isn't permissioned for any step in the Results Workflow."
    );
  }

  return E("div", null,
    E("div", { className: "mb-3" },
      E("h2", { className: "text-base font-bold", style: { color: C.ink } }, "Results Workflow"),
      E("div", { className: "text-xs mt-0.5", style: { color: C.muted } },
        "Upload → Review → Approve → Release — one place, filtered to what your role can act on."
      )
    ),
    E("div", { className: "flex gap-2 mb-4 flex-wrap" }, visible.map(s =>
      E("button", {
        key: s.k,
        onClick: () => setActive(s.k),
        className: "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium",
        style: {
          background: active === s.k ? C.teal : "#fff",
          color: active === s.k ? "#fff" : C.muted,
          border: `1px solid ${active === s.k ? C.teal : C.border}`
        }
      }, E(Icon, { name: s.icon, size: 14 }), s.label)
    )),
    active === "upload" && E(PendingUploadQueue, { subBatches, samples, testRecords, testTypes, references, goToTestEntry }),
    active === "review" && E(ReviewQueue, { samples, setSamples, testRecords, testTypes, parameters, references, session, notify, goToSample }),
    active === "approve" && E(ApproveQueue, { samples, setSamples, testRecords, testTypes, parameters, references, session, notify, goToSample }),
    active === "release" && E(ReleaseQueue, { samples, setSamples, testRecords, testTypes, references, session, notify, goToSample })
  );
}

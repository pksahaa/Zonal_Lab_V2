// ===== 16-sub-batch.js =====
// ============================================================================
// SUB-BATCH — a persistent grouping of pending samples (typically 15-20) that
// will be tested together for one method, sharing one QC check. A Sub-Batch
// is created from the Samples tab ("Sub-Batches" sub-view) but the actual
// testing — results, QC, and inventory deduction — happens in Add Test
// Record, which can consume a Sub-Batch instead of a single Sample.
//
// A Sub-Batch's members can come from different registration batches
// (different `batchRef`s) — that's fine, since reporting is done by
// filtering Samples on their own `batchRef`, independent of which Sub-Batch
// tested them. See getSampleResultForTest() below and the Report Generator's
// "Filter by Batch Ref" control in 17-report-generator.js.
// ============================================================================

const SUBBATCH_ELIGIBLE_STATUSES = ["registered", "received", "assigned", "in_progress"];
function generateSubBatchLabel(existingSubBatches) {
  const year = todayStr().slice(0, 4);
  const nums = (existingSubBatches || []).filter(sb => (sb.label || "").startsWith(`SB-${year}-`)).map(sb => Number(sb.label.split("-")[2]) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SB-${year}-${String(next).padStart(4, "0")}`;
}
function createSubBatch(fields, existingSubBatches) {
  return {
    id: uid("sb"),
    label: fields.label || generateSubBatchLabel(existingSubBatches),
    testTypeId: fields.testTypeId,
    testTypeName: fields.testTypeName,
    memberSampleIds: fields.memberSampleIds || [],
    assignedTester: fields.assignedTester || "",
    status: "pending",
    // pending -> tested (Add Test Record flips this on save)
    testRecordId: null,
    createdAt: new Date().toISOString()
  };
}

// Shared lookup used by the QC Module banner, Sample review, and the Report
// Generator: find a sample's result for a given test, whether it came from a
// single Add Test Record entry (sampleId set directly) or from inside a
// Sub-Batch's memberResults (memberSampleIds + memberResults).
function getSampleResultForTest(sample, testTypeId, testRecords) {
  const direct = (testRecords || []).find(r => r.testTypeId === testTypeId && r.sampleId === sample.id);
  if (direct) return {
    results: direct.results || [],
    recordId: direct.id,
    date: direct.date,
    source: "single"
  };
  const run = (testRecords || []).find(r => r.testTypeId === testTypeId && Array.isArray(r.memberSampleIds) && r.memberSampleIds.includes(sample.id));
  if (run) {
    const member = (run.memberResults || []).find(m => m.sampleId === sample.id);
    if (member) return {
      results: member.results || [],
      recordId: run.id,
      date: run.date,
      source: "subBatch"
    };
  }
  return null;
}

// ---- THE canonical "is this sample already spoken for, for this test?"
// check. Use this everywhere a sample-eligibility pool for a Test Type is
// built (Sub-Batch creation, Bulk Result Upload, Add Test Record's single-
// sample picker) so a sample can never end up double-booked for the same
// test via two different entry points. A sample is "committed" if:
//   1. it already has a result (single Add Test Record OR a tested Sub-Batch), OR
//   2. it's a member of a still-PENDING Sub-Batch (reserved, not yet tested).
// `excludeSubBatchId` lets a Sub-Batch being edited ignore its own current
// membership (otherwise its own members would wrongly look unavailable).
function sampleAlreadyCommittedForTest(sample, testTypeId, testRecords, subBatches, excludeSubBatchId) {
  if (getSampleResultForTest(sample, testTypeId, testRecords)) return true;
  return (subBatches || []).some(sb => sb.status === "pending" && sb.id !== excludeSubBatchId && sb.testTypeId === testTypeId && sb.memberSampleIds.includes(sample.id));
}

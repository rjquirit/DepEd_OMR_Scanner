import fs from "fs";
import path from "path";
import { processOMRImageWithCV } from "../src/utils/serverOmrCv";
import { DEFAULT_OMR_CONFIG, TARGET_FIDUCIALS } from "../src/utils/omrConfig";
import { getPrecomputedMasks } from "../src/utils/omrMeasurementCore";

async function runRegressionTestSuite() {
  console.log("==================================================================");
  console.log(" DEPED REGION X 60-ITEM OMR CV ENGINE REGRESSION TEST SUITE (V5)");
  console.log("==================================================================");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
    }
  }

  // 1. Precomputed Circle Mask Verification
  console.log("\n1. Testing Precomputed Circular Masks...");
  const masks = getPrecomputedMasks(
    DEFAULT_OMR_CONFIG.questionCoreRadius,
    DEFAULT_OMR_CONFIG.questionRingInnerRadius,
    DEFAULT_OMR_CONFIG.questionRingOuterRadius,
    DEFAULT_OMR_CONFIG.questionPaperRingInnerRadius,
    DEFAULT_OMR_CONFIG.questionPaperRingOuterRadius
  );
  assert(masks.core.length > 100, "Core mask contains points", `Count: ${masks.core.length}`);
  assert(masks.ring.length > 100, "Ring mask contains points", `Count: ${masks.ring.length}`);
  assert(masks.paper.length > 200, "Paper annulus mask contains points", `Count: ${masks.paper.length}`);

  // 2. Blank Answer Sheet Evaluation
  console.log("\n2. Testing Blank Answer Sheet Recognition...");
  const blankPath = path.join(process.cwd(), "public/samples/blank_bubble_sheet_60.png");
  if (fs.existsSync(blankPath)) {
    const blankBuf = fs.readFileSync(blankPath);
    const blankRes = await processOMRImageWithCV(blankBuf);

    assert(blankRes.alignment?.valid === true, "Blank sheet fiducials locked");
    assert((blankRes.alignment?.reprojectionErrorPx || 0) < 3.0, "Blank sheet reprojection error < 3.0px", `Error: ${blankRes.alignment?.reprojectionErrorPx}px`);
    assert(blankRes.telemetry?.blankCount === 60, "All 60 items detected as BLANK on blank sheet", `Detected blanks: ${blankRes.telemetry?.blankCount}`);
    assert(blankRes.telemetry?.filledCount === 0, "0 items detected as filled on blank sheet", `Detected filled: ${blankRes.telemetry?.filledCount}`);
    assert(blankRes.student_lrn === "????????????", "Blank LRN detected as unknown digits", `LRN: ${blankRes.student_lrn}`);
  } else {
    console.warn("  [SKIP] Blank sample image not found at " + blankPath);
  }

  // 3. Answered Sample Sheet Evaluation
  console.log("\n3. Testing Answered Sample Sheet Recognition...");
  const answeredPath = path.join(process.cwd(), "public/samples/sample_answered_60.png");
  if (fs.existsSync(answeredPath)) {
    const ansBuf = fs.readFileSync(answeredPath);
    const ansRes = await processOMRImageWithCV(ansBuf);

    assert(ansRes.alignment?.valid === true, "Answered sheet fiducials locked");
    assert((ansRes.alignment?.reprojectionErrorPx || 0) < 3.0, "Answered sheet reprojection error < 3.0px", `Error: ${ansRes.alignment?.reprojectionErrorPx}px`);
    assert(ansRes.student_lrn === "112298760012", "Extracted Student LRN matches ground truth", `Expected: 112298760012, Got: ${ansRes.student_lrn}`);
    assert(ansRes.telemetry?.filledCount === 60, "All 60 items recognized as filled answers", `Filled items: ${ansRes.telemetry?.filledCount}`);
    assert(ansRes.telemetry?.blankCount === 0, "Zero blanks on fully answered sheet");
    assert(ansRes.telemetry?.multipleCount === 0, "Zero multiple marks on cleanly answered sheet");
    assert((ansRes.telemetry?.averageConfidence || 0) >= 0.85, "High average confidence (>85%)", `Avg Conf: ${ansRes.telemetry?.averageConfidence}`);

    // Verify key sample items (Q1=A, Q4=B, Q5=C, Q6=D, Q60=D)
    const q1 = ansRes.answers.find((a) => a.item_number === 1);
    const q4 = ansRes.answers.find((a) => a.item_number === 4);
    const q5 = ansRes.answers.find((a) => a.item_number === 5);
    const q6 = ansRes.answers.find((a) => a.item_number === 6);
    const q60 = ansRes.answers.find((a) => a.item_number === 60);

    assert(q1?.selected_option === "A", "Q1 Answer is A", `Got: ${q1?.selected_option}`);
    assert(q4?.selected_option === "B", "Q4 Answer is B", `Got: ${q4?.selected_option}`);
    assert(q5?.selected_option === "C", "Q5 Answer is C", `Got: ${q5?.selected_option}`);
    assert(q6?.selected_option === "D", "Q6 Answer is D", `Got: ${q6?.selected_option}`);
    assert(q60?.selected_option === "D", "Q60 Answer is D", `Got: ${q60?.selected_option}`);
  } else {
    console.warn("  [SKIP] Answered sample image not found at " + answeredPath);
  }

  console.log("\n==================================================================");
  console.log(` REGRESSION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log("==================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRegressionTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

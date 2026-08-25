import { AnswerKey, GradingResult, ItemGrading, OMRScanResult, OptionType, ScannedRecord } from "../types";

export const DEFAULT_ANSWER_KEY: AnswerKey = {
  id: "default-key-60",
  title: "Standard 60-Item Key (General Science)",
  subject: "Science & Technology",
  grade_level: "Grade 10",
  created_at: new Date().toISOString(),
  passing_score_percentage: 75,
  total_items: 60,
  keys: {
    1: "A", 2: "B", 3: "C", 4: "D", 5: "A", 6: "C", 7: "B", 8: "D", 9: "B", 10: "A",
    11: "C", 12: "D", 13: "A", 14: "B", 15: "C", 16: "D", 17: "A", 18: "B", 19: "C", 20: "D",
    21: "A", 22: "B", 23: "C", 24: "D", 25: "A", 26: "B", 27: "C", 28: "D", 29: "A", 30: "B",
    31: "C", 32: "D", 33: "A", 34: "B", 35: "C", 36: "D", 37: "A", 38: "B", 39: "C", 40: "D",
    41: "A", 42: "B", 43: "C", 44: "D", 45: "A", 46: "B", 47: "C", 48: "D", 49: "A", 50: "B",
    51: "C", 52: "D", 53: "A", 54: "B", 55: "C", 56: "D", 57: "A", 58: "B", 59: "C", 60: "D",
  },
};

export function gradeScanResult(scan: OMRScanResult, key?: AnswerKey): GradingResult {
  const activeKey = key || DEFAULT_ANSWER_KEY;
  const items: ItemGrading[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let multipleCount = 0;

  const totalItems = activeKey.total_items || 60;

  for (let i = 1; i <= totalItems; i++) {
    const studentAns = scan.answers.find((a) => a.item_number === i)?.selected_option || null;
    const correctAns = activeKey.keys[i];

    let status: ItemGrading["status"] = "no_key";
    let isCorrect = false;

    if (!correctAns) {
      status = "no_key";
    } else if (studentAns === null) {
      status = "unanswered";
      unansweredCount++;
    } else if (studentAns === "MULTIPLE") {
      status = "multiple";
      multipleCount++;
    } else if (studentAns === correctAns) {
      status = "correct";
      isCorrect = true;
      correctCount++;
    } else {
      status = "incorrect";
      incorrectCount++;
    }

    items.push({
      item_number: i,
      student_answer: studentAns,
      correct_answer: correctAns,
      is_correct: isCorrect,
      status,
    });
  }

  const score = correctCount;
  const percentage = totalItems > 0 ? (score / totalItems) * 100 : 0;
  const passingThreshold = activeKey.passing_score_percentage || 75;
  const passed = percentage >= passingThreshold;

  return {
    score,
    total_items: totalItems,
    percentage: Math.round(percentage * 10) / 10,
    passed,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    multiple_count: multipleCount,
    items,
  };
}

export function exportRosterToCSV(records: ScannedRecord[]): string {
  const headers = [
    "Scan ID",
    "Timestamp",
    "Student LRN",
    "Student Name",
    "Section",
    "Grade Level",
    "School ID",
    "Subject",
    "Score",
    "Total Items",
    "Percentage",
    "Status",
    ...Array.from({ length: 60 }, (_, i) => `Q${i + 1}`),
  ];

  const rows = records.map((rec) => {
    const ansMap = new Map(rec.scan_result.answers.map((a) => [a.item_number, a.selected_option || "BLANK"]));
    const answerCols = Array.from({ length: 60 }, (_, i) => ansMap.get(i + 1) || "BLANK");

    return [
      rec.id,
      rec.timestamp,
      `"${rec.student_lrn}"`,
      `"${rec.student_name || "N/A"}"`,
      `"${rec.section || "N/A"}"`,
      `"${rec.scan_result.metadata.grade_level || "N/A"}"`,
      `"${rec.scan_result.metadata.school_id || "N/A"}"`,
      `"${rec.subject || "N/A"}"`,
      rec.score ?? "N/A",
      rec.total_items ?? 60,
      `${rec.percentage ?? 0}%`,
      rec.passed ? "PASSED" : "FAILED",
      ...answerCols,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export type RecallGrade = "again" | "hard" | "good" | "easy";

export type ProgressRecord = {
  question_id: string;
  question_title: string;
  status: "solved" | "unsolved";
  interval_days: number;
  review_count: number;
  next_review_at: string | null;
  last_review_at: string | null;
};

// A friendly, adaptive Leitner-style sequence. The actual next gap depends on recall quality.
const DEFAULT_GAPS = [1, 3, 7, 14, 30, 60, 120];

export function scheduleReview(currentInterval: number, grade: RecallGrade, from = new Date()) {
  const index = Math.max(0, DEFAULT_GAPS.findIndex((gap) => gap >= Math.max(currentInterval, 1)));
  const nextIndex = grade === "again" ? 0 : grade === "hard" ? Math.max(0, index) : grade === "good" ? Math.min(DEFAULT_GAPS.length - 1, index + 1) : Math.min(DEFAULT_GAPS.length - 1, index + 2);
  const intervalDays = grade === "hard" ? Math.max(1, Math.round(DEFAULT_GAPS[index] * 0.8)) : DEFAULT_GAPS[nextIndex];
  const due = new Date(from);
  due.setDate(due.getDate() + intervalDays);
  return { intervalDays, nextReviewAt: due.toISOString() };
}

export function isDue(nextReviewAt: string | null, now = new Date()) {
  return Boolean(nextReviewAt && new Date(nextReviewAt).getTime() <= now.getTime());
}

export function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Due today";
  if (date.toDateString() === tomorrow.toDateString()) return "Due tomorrow";
  return `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}


import type {
  GeneratedPlan,
  PlanInput,
  PlanSession,
  PlanTaskType,
  TextbookUnit,
} from "./types";

type Task = {
  id: string;
  unitId: string | null;
  unitTitle: string;
  title: string;
  type: PlanTaskType;
  minutes: number;
  pageRange?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const roundToFive = (value: number) => Math.max(5, Math.round(value / 5) * 5);

const toLocalDate = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function createTasks(units: TextbookUnit[]): Task[] {
  const learningTasks: Task[] = [];
  const reviewTasks: Task[] = [];

  for (const unit of units) {
    const pageRange = `p.${unit.pageFrom}~${unit.pageTo}`;
    const conceptBudget = roundToFive(unit.estimatedMinutes * 0.35);
    const practiceBudget = roundToFive(unit.estimatedMinutes * 0.45);
    const reviewBudget = roundToFive(unit.estimatedMinutes * 0.2);
    const conceptMinutes = roundToFive(conceptBudget / Math.max(1, unit.concepts.length));

    unit.concepts.forEach((concept, index) => {
      learningTasks.push({
        id: `${unit.id}-concept-${index}`,
        unitId: unit.id,
        unitTitle: unit.title,
        title: `${concept} 개념 이해`,
        type: "concept",
        minutes: conceptMinutes,
        pageRange,
      });
    });

    let practiceRemaining = practiceBudget;
    let practiceIndex = 1;
    while (practiceRemaining > 0) {
      const minutes = Math.min(25, practiceRemaining);
      learningTasks.push({
        id: `${unit.id}-practice-${practiceIndex}`,
        unitId: unit.id,
        unitTitle: unit.title,
        title: `${unit.title} 교과서 문제 ${practiceIndex}`,
        type: "practice",
        minutes,
        pageRange,
      });
      practiceRemaining -= minutes;
      practiceIndex += 1;
    }

    reviewTasks.push({
      id: `${unit.id}-review`,
      unitId: unit.id,
      unitTitle: unit.title,
      title: `${unit.title} 오답·핵심 복습`,
      type: "review",
      minutes: reviewBudget,
      pageRange,
    });
  }

  if (units.length > 0) {
    reviewTasks.push({
      id: "final-mock",
      unitId: null,
      unitTitle: "시험 범위 전체",
      title: "시험 전 최종 점검",
      type: "mock",
      minutes: units.length >= 3 ? 40 : 30,
    });
  }

  return [...learningTasks, ...reviewTasks];
}

export function generateStudyPlan(
  input: PlanInput,
  textbookUnits: TextbookUnit[],
  today: Date = new Date(),
): GeneratedPlan {
  const selectedUnits = textbookUnits
    .filter((unit) => input.selectedUnitIds.includes(unit.id))
    .sort((a, b) => a.order - b.order);
  const tasks = createTasks(selectedUnits);
  const examDate = toLocalDate(input.examDate);
  const cursor = toLocalDate(today);
  const availableDates: Array<{ date: Date; minutes: number }> = [];

  while (cursor.getTime() < examDate.getTime()) {
    const minutes = Math.max(0, input.availability[cursor.getDay()] ?? 0);
    if (minutes > 0) availableDates.push({ date: new Date(cursor), minutes });
    cursor.setTime(cursor.getTime() + DAY_MS);
  }

  const totalAvailableMinutes = availableDates.reduce((sum, slot) => sum + slot.minutes, 0);
  const totalRequiredMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const sessions: PlanSession[] = [];
  let taskIndex = 0;
  let taskRemaining = tasks[0]?.minutes ?? 0;

  for (const slot of availableDates) {
    let dayRemaining = slot.minutes;

    while (dayRemaining > 0 && taskIndex < tasks.length) {
      const task = tasks[taskIndex];
      const duration = Math.min(dayRemaining, taskRemaining, 30);

      sessions.push({
        id: `${task.id}-${toDateKey(slot.date)}-${sessions.length}`,
        date: toDateKey(slot.date),
        unitId: task.unitId,
        unitTitle: task.unitTitle,
        title: taskRemaining < task.minutes ? `${task.title} 이어서` : task.title,
        type: task.type,
        durationMinutes: duration,
        pageRange: task.pageRange,
      });

      taskRemaining -= duration;
      dayRemaining -= duration;

      if (taskRemaining <= 0) {
        taskIndex += 1;
        taskRemaining = tasks[taskIndex]?.minutes ?? 0;
      }
    }

    if (taskIndex >= tasks.length) break;
  }

  const scheduledMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const coveragePercent = totalRequiredMinutes === 0
    ? 0
    : Math.min(100, Math.round((scheduledMinutes / totalRequiredMinutes) * 100));
  const capacityRatio = totalRequiredMinutes === 0 ? 0 : totalAvailableMinutes / totalRequiredMinutes;
  const status = capacityRatio >= 1.15 ? "balanced" : capacityRatio >= 1 ? "tight" : "overloaded";

  let warning: string | undefined;
  if (availableDates.length === 0) warning = "시험 전 학습 가능한 날이 없어요. 요일이나 시간을 추가해주세요.";
  else if (status === "overloaded") {
    const shortage = Math.max(0, totalRequiredMinutes - totalAvailableMinutes);
    warning = `현재 시간으로는 약 ${shortage}분이 부족해요. 학습 시간을 늘리거나 시험 범위를 줄여주세요.`;
  } else if (status === "tight") warning = "계획을 완료할 수 있지만 여유 시간이 적어요. 가능한 날을 하루 더 추가하는 것을 권장해요.";

  return {
    sessions,
    totalRequiredMinutes,
    totalAvailableMinutes,
    scheduledMinutes,
    coveragePercent,
    studyDayCount: new Set(sessions.map((session) => session.date)).size,
    status,
    warning,
  };
}

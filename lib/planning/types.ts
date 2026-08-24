export type PlanTaskType = "concept" | "practice" | "review" | "mock";

export type TextbookUnit = {
  id: string;
  order: number;
  title: string;
  pageFrom: number;
  pageTo: number;
  estimatedMinutes: number;
  concepts: string[];
};

export type WeeklyAvailability = Record<number, number>;

export type PlanInput = {
  examDate: string;
  selectedUnitIds: string[];
  availability: WeeklyAvailability;
  weakConcepts?: Array<{ conceptName: string; masteryScore: number }>;
};

export type PlanSession = {
  id: string;
  date: string;
  unitId: string | null;
  unitTitle: string;
  title: string;
  type: PlanTaskType;
  durationMinutes: number;
  pageRange?: string;
};

export type GeneratedPlan = {
  sessions: PlanSession[];
  totalRequiredMinutes: number;
  totalAvailableMinutes: number;
  scheduledMinutes: number;
  coveragePercent: number;
  studyDayCount: number;
  status: "balanced" | "tight" | "overloaded";
  weakConceptCount?: number;
  warning?: string;
};

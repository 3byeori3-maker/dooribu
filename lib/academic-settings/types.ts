export const GRADE_LEVELS = ["초6", "중1", "중2", "중3", "고1", "고2", "고3"] as const;
export const SEMESTERS = ["1학기", "2학기"] as const;
export const EXAM_TYPES = ["none", "midterm", "final"] as const;

export type GradeLevel = typeof GRADE_LEVELS[number];
export type Semester = typeof SEMESTERS[number];
export type ExamType = typeof EXAM_TYPES[number];

export type AcademicSettings = {
  gradeLevel: GradeLevel;
  semester: Semester;
  examType: ExamType;
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  none: "선택 안 함",
  midterm: "중간고사",
  final: "기말고사",
};

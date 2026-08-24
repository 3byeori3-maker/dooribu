export type TextbookConfidence = "high" | "medium" | "low";

export type TextbookMetadata = {
  title: string;
  publisher: string;
  authors: string[];
  subject: string;
  gradeLevel: string;
  semester: string;
  curriculum: string;
  isbn: string;
  confidence: TextbookConfidence;
  notes: string;
};

export type LearningProfile = {
  region: string;
  schoolName: string;
  schoolConfirmedByUser: boolean;
  textbook: TextbookMetadata;
  textbookConfirmedByUser: boolean;
  updatedAt: string;
};

export const EMPTY_TEXTBOOK: TextbookMetadata = {
  title: "",
  publisher: "",
  authors: [],
  subject: "수학",
  gradeLevel: "중1",
  semester: "1학기",
  curriculum: "2022 개정",
  isbn: "",
  confidence: "low",
  notes: "",
};

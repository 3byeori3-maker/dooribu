import type { MistakeCategory } from "@/lib/mastery/types";

export type SolutionAnalysisStatus = "correct" | "partially_correct" | "incorrect" | "unclear";
export type SolutionAnalysisConfidence = "high" | "medium" | "low";

export type SolutionAnalysis = {
  status: SolutionAnalysisStatus;
  confidence: SolutionAnalysisConfidence;
  recognizedProblem: string;
  recognizedWork: string[];
  summary: string;
  primaryConcept: string;
  mistakeCategory: MistakeCategory;
  mistakeLabel: string;
  correctSteps: string[];
  firstError: {
    found: boolean;
    step: string;
    explanation: string;
    hint: string;
  };
  nextAction: string;
  followUpQuestion: string;
};

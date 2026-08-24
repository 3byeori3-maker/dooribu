export type SolutionAnalysisStatus = "correct" | "partially_correct" | "incorrect" | "unclear";
export type SolutionAnalysisConfidence = "high" | "medium" | "low";

export type SolutionAnalysis = {
  status: SolutionAnalysisStatus;
  confidence: SolutionAnalysisConfidence;
  recognizedProblem: string;
  recognizedWork: string[];
  summary: string;
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

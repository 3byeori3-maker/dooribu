export type ConceptCheck = {
  topic: string;
  whyItMatters: string;
  prerequisites: string[];
  diagnostic: {
    question: string;
    choices: string[];
    correctChoiceIndex: number;
  };
  conceptSummary: string;
  miniExample: string;
  commonMistake: string;
  bridgePrompt: string;
};

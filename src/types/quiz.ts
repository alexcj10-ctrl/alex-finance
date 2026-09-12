export type QuizChoice = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string;
  domanda: string;
  risposte: readonly [QuizChoice, QuizChoice, ...QuizChoice[]];
};

export type LessonQuiz = {
  id: string;
  domande: readonly [QuizQuestion, QuizQuestion, QuizQuestion?];
};

export type QuizAnswerResult = {
  questionId: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  feedback: string;
};

export type QuizAttemptResult = {
  attemptId: string;
  attemptNumber: number;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  pointsEarned: number;
  completedAt: string;
  answers: readonly QuizAnswerResult[];
};

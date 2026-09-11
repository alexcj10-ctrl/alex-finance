export type QuizChoice = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string;
  domanda: string;
  risposte: readonly [QuizChoice, QuizChoice, ...QuizChoice[]];
  rispostaCorrettaId: QuizChoice['id'];
  feedback: string;
};

export type LessonQuiz = {
  id: string;
  domande: readonly [QuizQuestion, QuizQuestion, QuizQuestion?];
};

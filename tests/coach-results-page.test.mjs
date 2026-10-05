import assert from 'node:assert/strict';
import test from 'node:test';

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

const {
  CoachResultsPage,
  deriveResultsOverview,
} = await vite.ssrLoadModule('/src/coach/pages/CoachResultsPage.tsx');

test.after(async () => {
  await vite.close();
});

function attempt({
  id,
  playerId,
  lessonId,
  score,
  correctAnswers,
  completedAt,
}) {
  return {
    id,
    teamId: 'team-1',
    playerId,
    playerName: `Giocatore ${playerId}`,
    lessonId,
    lessonTitle: `Lezione ${lessonId}`,
    score,
    totalQuestions: 3,
    correctAnswers,
    completedAt,
  };
}

await test('usa solo l’ultimo tentativo per giocatore e lezione', () => {
  const attempts = [
    attempt({ id: 'p1-l1-old', playerId: 'p1', lessonId: 'l1', score: 67, correctAnswers: 2, completedAt: '2026-10-01T10:00:00Z' }),
    attempt({ id: 'p1-l1-new', playerId: 'p1', lessonId: 'l1', score: 100, correctAnswers: 3, completedAt: '2026-10-02T10:00:00Z' }),
    attempt({ id: 'p2-l1-old', playerId: 'p2', lessonId: 'l1', score: 33, correctAnswers: 1, completedAt: '2026-10-01T11:00:00Z' }),
    attempt({ id: 'p2-l1-new', playerId: 'p2', lessonId: 'l1', score: 67, correctAnswers: 2, completedAt: '2026-10-03T11:00:00Z' }),
    attempt({ id: 'p2-l2', playerId: 'p2', lessonId: 'l2', score: 33, correctAnswers: 1, completedAt: '2026-10-04T11:00:00Z' }),
    attempt({ id: 'p3-l1', playerId: 'p3', lessonId: 'l1', score: 67, correctAnswers: 2, completedAt: '2026-10-05T11:00:00Z' }),
  ];

  const result = deriveResultsOverview(attempts);

  assert.equal(result.completedCount, 6);
  assert.equal(result.perfectCount, 1);
  assert.deepEqual(
    result.reviewAttempts.map((item) => item.id),
    ['p2-l2', 'p3-l1', 'p2-l1-new'],
  );
  assert.equal(result.reviewAttempts.filter((item) => item.playerId === 'p2').length, 2);
  assert.equal(result.reviewAttempts.some((item) => item.id === 'p1-l1-old'), false);
  assert.equal(result.reviewAttempts.some((item) => item.id === 'p1-l1-new'), false);
});

await test('mostra lo stato positivo quando tutti gli ultimi tentativi sono perfetti', () => {
  const quizAttempts = [
    attempt({ id: 'old', playerId: 'p1', lessonId: 'l1', score: 67, correctAnswers: 2, completedAt: '2026-10-01T10:00:00Z' }),
    attempt({ id: 'latest', playerId: 'p1', lessonId: 'l1', score: 100, correctAnswers: 3, completedAt: '2026-10-02T10:00:00Z' }),
  ];
  const model = {
    source: 'supabase',
    generatedAt: '2026-10-05T12:00:00Z',
    team: { id: 'team-1', name: 'Esordienti', season: '2026/27' },
    coachName: 'Coach',
    kpis: {
      activePlayers: 1,
      averageProgressPercent: 0,
      completedLessons: 0,
      averageQuizPercent: 100,
      distributedPoints: 0,
    },
    attention: [],
    players: [],
    lessonAggregates: [],
    quizAttempts,
    getPlayerDetail: () => undefined,
  };

  const html = renderToStaticMarkup(createElement(CoachResultsPage, { model }));

  assert.match(html, /Nessun quiz da rivedere/);
  assert.match(html, /Tutti gli ultimi tentativi risultano completati senza errori\./);
  assert.doesNotMatch(html, /<table/);
});

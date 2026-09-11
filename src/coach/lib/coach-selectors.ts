import {
  phaseOrderByMacro,
  type Lesson,
  type PhaseId,
} from '../../data/lessons';
import type {
  AttentionItem,
  CoachDataset,
  CoachLessonAggregate,
  CoachPlayerDetail,
  CoachPlayerSummary,
  CoachQuizAttemptRecord,
  CoachReadModel,
} from '../../types/coach';

const attentionThresholds = {
  inactiveDays: 7,
  notStartedDays: 5,
  stalledDays: 3,
  lowQuizPercent: 60,
} as const;

const allPhases: readonly PhaseId[] = [
  ...phaseOrderByMacro.possesso,
  ...phaseOrderByMacro.non_possesso,
];

function roundedAverage(values: readonly number[]) {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function elapsedDays(reference: string, earlier: string | undefined) {
  if (!earlier) return Number.POSITIVE_INFINITY;
  const referenceTime = Date.parse(reference);
  const earlierTime = Date.parse(earlier);
  if (!Number.isFinite(referenceTime) || !Number.isFinite(earlierTime)) return 0;
  return Math.max((referenceTime - earlierTime) / 86_400_000, 0);
}

function latestQuizAttempts(attempts: readonly CoachQuizAttemptRecord[]) {
  const latest = new Map<string, CoachQuizAttemptRecord>();

  for (const attempt of attempts) {
    const key = `${attempt.playerId}::${attempt.lessonId}`;
    const current = latest.get(key);
    if (!current || Date.parse(attempt.completedAt) > Date.parse(current.completedAt)) {
      latest.set(key, attempt);
    }
  }

  return latest;
}

function compareAttention(left: AttentionItem, right: AttentionItem) {
  const severity = { alta: 0, media: 1 } as const;
  return (
    severity[left.severity] - severity[right.severity] ||
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  );
}

export function buildCoachReadModel(
  dataset: CoachDataset,
  catalog: readonly Lesson[],
): CoachReadModel {
  const trackedLessons = catalog.filter(
    (lesson) => lesson.disponibilita === 'disponibile' && lesson.demo === false,
  );
  const trackedLessonById = new Map(trackedLessons.map((lesson) => [lesson.id, lesson]));
  const profileById = new Map(dataset.profiles.map((profile) => [profile.id, profile]));
  const activePlayerIds = new Set(
    dataset.memberships
      .filter(
        (membership) =>
          membership.teamId === dataset.team.id &&
          membership.role === 'player' &&
          membership.active &&
          profileById.get(membership.profileId)?.role === 'player',
      )
      .map((membership) => membership.profileId),
  );
  const relevantProgress = dataset.lessonProgress.filter(
    (progress) =>
      progress.teamId === dataset.team.id &&
      activePlayerIds.has(progress.playerId) &&
      trackedLessonById.has(progress.lessonId),
  );
  const relevantVideos = dataset.videoProgress.filter(
    (progress) =>
      progress.teamId === dataset.team.id &&
      activePlayerIds.has(progress.playerId) &&
      trackedLessonById.has(progress.lessonId),
  );
  const relevantQuizzes = dataset.quizAttempts.filter(
    (attempt) =>
      attempt.teamId === dataset.team.id &&
      activePlayerIds.has(attempt.playerId) &&
      trackedLessonById.has(attempt.lessonId),
  );
  const latestQuizByPlayerLesson = latestQuizAttempts(relevantQuizzes);
  const relevantActivities = dataset.activityEvents.filter(
    (event) => event.teamId === dataset.team.id && activePlayerIds.has(event.playerId),
  );
  const latestActivityByPlayer = new Map<string, string>();

  for (const event of relevantActivities) {
    const current = latestActivityByPlayer.get(event.playerId);
    if (!current || Date.parse(event.createdAt) > Date.parse(current)) {
      latestActivityByPlayer.set(event.playerId, event.createdAt);
    }
  }

  const attention: AttentionItem[] = [];

  for (const playerId of activePlayerIds) {
    const playerName = profileById.get(playerId)?.displayName ?? 'Giocatore';
    const lastActivityAt = latestActivityByPlayer.get(playerId);
    const inactiveFor = elapsedDays(dataset.generatedAt, lastActivityAt);

    if (inactiveFor >= attentionThresholds.inactiveDays) {
      const hasActivity = Boolean(lastActivityAt);
      attention.push({
        id: `inactive:${playerId}`,
        playerId,
        kind: 'inattivo',
        severity: 'alta',
        title: hasActivity
          ? `${playerName} non accede da ${Math.floor(inactiveFor)} giorni`
          : `${playerName} non ha ancora effettuato accessi`,
        detail: hasActivity
          ? 'Controlla se ha bisogno di aiuto per riprendere il percorso.'
          : 'Non risultano ancora attività registrate nel percorso.',
        occurredAt: lastActivityAt ?? profileById.get(playerId)?.createdAt ?? dataset.generatedAt,
      });
    }
  }

  for (const progress of relevantProgress) {
    const lesson = trackedLessonById.get(progress.lessonId);
    const playerName = profileById.get(progress.playerId)?.displayName ?? 'Giocatore';
    if (!lesson) continue;

    if (
      progress.status === 'da_fare' &&
      elapsedDays(dataset.generatedAt, progress.assignedAt) >= attentionThresholds.notStartedDays
    ) {
      attention.push({
        id: `not-started:${progress.playerId}:${progress.lessonId}`,
        playerId: progress.playerId,
        lessonId: progress.lessonId,
        kind: 'lezione_non_iniziata',
        severity: 'media',
        title: `${playerName} deve ancora iniziare`,
        detail: lesson.titolo,
        occurredAt: progress.assignedAt,
      });
    }

    if (
      progress.status === 'in_corso' &&
      elapsedDays(dataset.generatedAt, progress.updatedAt) >= attentionThresholds.stalledDays
    ) {
      attention.push({
        id: `stalled:${progress.playerId}:${progress.lessonId}`,
        playerId: progress.playerId,
        lessonId: progress.lessonId,
        kind: 'lezione_bloccata',
        severity: 'alta',
        title: `${playerName} ha una lezione in sospeso`,
        detail: `${lesson.titolo} · ${progress.progressPercent}%`,
        occurredAt: progress.updatedAt,
      });
    }
  }

  for (const attempt of latestQuizByPlayerLesson.values()) {
    if (attempt.score >= attentionThresholds.lowQuizPercent) continue;
    const lesson = trackedLessonById.get(attempt.lessonId);
    const playerName = profileById.get(attempt.playerId)?.displayName ?? 'Giocatore';
    if (!lesson) continue;

    attention.push({
      id: `low-quiz:${attempt.playerId}:${attempt.lessonId}`,
      playerId: attempt.playerId,
      lessonId: attempt.lessonId,
      kind: 'quiz_basso',
      severity: 'alta',
      title: `${playerName} ha ottenuto ${Math.round(attempt.score)}%`,
      detail: `Verifica la comprensione di “${lesson.titolo}”.`,
      occurredAt: attempt.completedAt,
    });
  }

  attention.sort(compareAttention);

  const players: CoachPlayerSummary[] = [];
  for (const playerId of activePlayerIds) {
      const profile = profileById.get(playerId);
      if (!profile) continue;
      const playerProgress = relevantProgress.filter((item) => item.playerId === playerId);
      const summary: CoachPlayerSummary = {
        playerId,
        displayName: profile.displayName,
        initials: getInitials(profile.displayName),
        progressPercent: roundedAverage(playerProgress.map((item) => item.progressPercent)) ?? 0,
        points: playerProgress.reduce((total, item) => total + item.pointsEarned, 0),
        completedLessons: playerProgress.filter((item) => item.status === 'completata').length,
        assignedLessons: playerProgress.length,
        trophyCount: dataset.playerTrophies.filter(
          (trophy) => trophy.teamId === dataset.team.id && trophy.playerId === playerId,
        ).length,
        attention: attention.filter((item) => item.playerId === playerId),
      };
      const lastActivityAt = latestActivityByPlayer.get(playerId);
      if (lastActivityAt) summary.lastActivityAt = lastActivityAt;
      players.push(summary);
  }
  players.sort((left, right) => left.displayName.localeCompare(right.displayName, 'it'));

  const lessonAggregates: CoachLessonAggregate[] = trackedLessons.map((lesson) => {
    const progress = relevantProgress.filter((item) => item.lessonId === lesson.id);
    const quizScores = [...latestQuizByPlayerLesson.values()]
      .filter((attempt) => attempt.lessonId === lesson.id)
      .map((attempt) => attempt.score);

    return {
      lesson,
      assignedPlayers: progress.length,
      completedPlayers: progress.filter((item) => item.status === 'completata').length,
      inProgressPlayers: progress.filter((item) => item.status === 'in_corso').length,
      todoPlayers: progress.filter((item) => item.status === 'da_fare').length,
      averageProgressPercent: roundedAverage(progress.map((item) => item.progressPercent)) ?? 0,
      averageQuizPercent: roundedAverage(quizScores),
      quizAttempts: relevantQuizzes.filter((attempt) => attempt.lessonId === lesson.id).length,
    };
  });

  const getPlayerDetail = (playerId: string): CoachPlayerDetail | undefined => {
    const summary = players.find((player) => player.playerId === playerId);
    if (!summary) return undefined;

    const playerProgress = relevantProgress.filter((item) => item.playerId === playerId);
    const phaseProgress = allPhases.map((phase) => {
      const phaseLessons = trackedLessons.filter((lesson) => lesson.fase === phase);
      const phaseLessonIds = new Set(phaseLessons.map((lesson) => lesson.id));
      const assigned = playerProgress.filter((item) => phaseLessonIds.has(item.lessonId));

      return {
        phase,
        availableLessons: phaseLessons.length,
        averageProgressPercent:
          phaseLessons.length > 0
            ? roundedAverage(assigned.map((item) => item.progressPercent)) ?? 0
            : undefined,
      };
    });
    const lessonViews = playerProgress
      .map((progress) => {
        const lesson = trackedLessonById.get(progress.lessonId);
        if (!lesson) return undefined;
        const validVariantIds = new Set(lesson.variantiVideo.map((variant) => variant.id));
        const videos = relevantVideos.filter(
          (video) =>
            video.playerId === playerId &&
            video.lessonId === lesson.id &&
            validVariantIds.has(video.variantId),
        );
        const latestQuizAttempt = latestQuizByPlayerLesson.get(`${playerId}::${lesson.id}`);

        return {
          lesson,
          progress,
          videos,
          maxWatchedPercent: Math.max(0, ...videos.map((video) => video.watchedPercent)),
          latestQuizAttempt,
          quizAttempts: relevantQuizzes.filter(
            (attempt) => attempt.playerId === playerId && attempt.lessonId === lesson.id,
          ).length,
        };
      })
      .filter((view): view is NonNullable<typeof view> => Boolean(view));

    return { summary, phaseProgress, lessons: lessonViews };
  };

  const coach = profileById.get(dataset.coachProfileId);
  const latestQuizScores = [...latestQuizByPlayerLesson.values()].map((attempt) => attempt.score);

  return {
    source: dataset.source,
    generatedAt: dataset.generatedAt,
    team: dataset.team,
    coachName: coach?.displayName ?? 'Allenatore',
    kpis: {
      activePlayers: players.length,
      averageProgressPercent: roundedAverage(relevantProgress.map((item) => item.progressPercent)) ?? 0,
      completedLessons: relevantProgress.filter((item) => item.status === 'completata').length,
      averageQuizPercent: roundedAverage(latestQuizScores),
      distributedPoints: relevantProgress.reduce((total, item) => total + item.pointsEarned, 0),
    },
    attention,
    players,
    lessonAggregates,
    quizAttempts: relevantQuizzes
      .map((attempt) => ({
        ...attempt,
        playerName: profileById.get(attempt.playerId)?.displayName ?? 'Giocatore',
        lessonTitle: trackedLessonById.get(attempt.lessonId)?.titolo ?? 'Lezione',
      }))
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt)),
    getPlayerDetail,
  };
}

import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';

import {
  assignLessonToTeam,
  updateLessonAudience,
} from '../../services/supabase/supabase-coach-actions';
import type { CoachReadModel } from '../../types/coach';
import type { PlayerBirthYear } from '../../types/database';
import { CoachPageHeader } from '../components/CoachPageHeader';
import { LessonAggregateList } from '../components/LessonAggregateList';

type LessonAudienceValue = 'both' | '2014' | '2015';

function readAudienceValue(years: readonly PlayerBirthYear[]): LessonAudienceValue {
  if (years.length === 1 && years[0] === 2014) return '2014';
  if (years.length === 1 && years[0] === 2015) return '2015';
  return 'both';
}

function writeAudienceValue(value: LessonAudienceValue): readonly PlayerBirthYear[] {
  if (value === '2014') return [2014];
  if (value === '2015') return [2015];
  return [2014, 2015];
}

export function CoachLessonsPage({
  model,
  canManage,
  onDataChanged,
}: {
  model: CoachReadModel;
  canManage: boolean;
  onDataChanged: () => void;
}) {
  const [assigningId, setAssigningId] = useState<string>();
  const [assignedId, setAssignedId] = useState<string>();
  const [error, setError] = useState<string>();
  const [savingAudienceId, setSavingAudienceId] = useState<string>();
  const [savedAudienceId, setSavedAudienceId] = useState<string>();
  const [audienceError, setAudienceError] = useState<string>();
  const [audienceOverrides, setAudienceOverrides] = useState<
    Record<string, readonly PlayerBirthYear[]>
  >({});

  const assign = async (lessonId: string) => {
    if (!canManage) return;
    setAssigningId(lessonId);
    setAssignedId(undefined);
    setError(undefined);
    try {
      await assignLessonToTeam(model.team.id, lessonId);
      setAssignedId(lessonId);
      onDataChanged();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Assegnazione non riuscita.');
    } finally {
      setAssigningId(undefined);
    }
  };

  const saveAudience = async (
    lessonId: string,
    eligibleBirthYears: readonly PlayerBirthYear[],
  ) => {
    if (!canManage || savingAudienceId) return;

    const previousOverride = audienceOverrides[lessonId];
    setSavingAudienceId(lessonId);
    setSavedAudienceId(undefined);
    setAudienceError(undefined);
    setAudienceOverrides((current) => ({ ...current, [lessonId]: eligibleBirthYears }));

    try {
      await updateLessonAudience(model.team.id, lessonId, eligibleBirthYears);
      setSavedAudienceId(lessonId);
      onDataChanged();
    } catch (saveError) {
      setAudienceOverrides((current) => {
        const next = { ...current };
        if (previousOverride) next[lessonId] = previousOverride;
        else delete next[lessonId];
        return next;
      });
      setAudienceError(
        saveError instanceof Error
          ? saveError.message
          : 'Aggiornamento destinatari non riuscito.',
      );
    } finally {
      setSavingAudienceId(undefined);
    }
  };

  return (
    <div className="coach-page">
      <CoachPageHeader
        eyebrow="Monitoraggio didattico"
        title="Lezioni"
        description="Lo stesso catalogo della Player App, letto a livello di squadra."
      />

      <section className="coach-assignment-panel" aria-labelledby="assignment-title">
        <header>
          <div>
            <p className="coach-create-kicker">Programmazione</p>
            <h2 id="assignment-title">Assegna alla squadra</h2>
            <p>Assegna le lezioni e scegli se sono destinate ai 2014, ai 2015 o a entrambi.</p>
          </div>
        </header>
        <div className="coach-assignment-actions">
          {model.lessonAggregates.map((item) => {
            const eligibleBirthYears =
              audienceOverrides[item.lesson.id] ?? item.lesson.eligibleBirthYears;

            return (
              <div className="coach-assignment-item" key={item.lesson.id}>
                <button
                  type="button"
                  disabled={!canManage || assigningId === item.lesson.id}
                  title={canManage ? undefined : 'Solo Coach Amministratore'}
                  onClick={() => void assign(item.lesson.id)}
                >
                  {assigningId === item.lesson.id
                    ? <LoaderCircle className="size-4 coach-loading-icon" aria-hidden="true" />
                    : assignedId === item.lesson.id
                      ? <CheckCircle2 className="size-4" aria-hidden="true" />
                      : <Send className="size-4" aria-hidden="true" />}
                  <span>{item.lesson.titolo}</span>
                  <strong>{assignedId === item.lesson.id ? 'Assegnata' : 'Assegna'}</strong>
                </button>

                <label className="coach-lesson-audience-control">
                  <span>Destinatari</span>
                  <select
                    aria-label={`Destinatari ${item.lesson.titolo}`}
                    disabled={!canManage || savingAudienceId !== undefined}
                    title={canManage ? undefined : 'Solo Coach Amministratore'}
                    value={readAudienceValue(eligibleBirthYears)}
                    onChange={(event) => void saveAudience(
                      item.lesson.id,
                      writeAudienceValue(event.currentTarget.value as LessonAudienceValue),
                    )}
                  >
                    <option value="both">2014 e 2015</option>
                    <option value="2014">Solo 2014</option>
                    <option value="2015">Solo 2015</option>
                  </select>
                  {savingAudienceId === item.lesson.id ? (
                    <small>Salvataggio…</small>
                  ) : savedAudienceId === item.lesson.id ? (
                    <small>Destinatari salvati</small>
                  ) : null}
                </label>
              </div>
            );
          })}
        </div>
        {error ? <p className="coach-create-error" role="alert">{error}</p> : null}
        {audienceError ? (
          <p className="coach-create-error" role="alert">{audienceError}</p>
        ) : null}
        {!canManage ? (
          <p className="coach-admin-only-note">Solo Coach Amministratore</p>
        ) : null}
      </section>

      <section className="coach-list-panel" aria-labelledby="lessons-list-title">
        <header className="coach-list-toolbar">
          <div>
            <h2 id="lessons-list-title">Lezioni reali disponibili</h2>
            <p>Le varianti video restano unite allo stesso principio didattico.</p>
          </div>
          <span className="coach-count-badge">{model.lessonAggregates.length}</span>
        </header>
        <LessonAggregateList lessons={model.lessonAggregates} />
      </section>
    </div>
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import * as webPush from 'web-push';

import { ApiError } from './http.js';

type PushTarget = {
  auth_key: string;
  endpoint: string;
  p256dh: string;
  subscription_id: string;
};

type LessonPushInput = {
  admin: SupabaseClient;
  body: string;
  coachId: string;
  lessonId: string;
  teamId: string;
  title: string;
};

let vapidConfigured = false;

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    throw new ApiError(
      503,
      'PUSH_NOT_CONFIGURED',
      'Le notifiche non sono temporaneamente disponibili.',
    );
  }

  let validSubject = subject.startsWith('mailto:');
  if (!validSubject) {
    try {
      const url = new URL(subject);
      validSubject = url.protocol === 'https:';
    } catch {
      validSubject = false;
    }
  }

  if (!validSubject) {
    throw new ApiError(
      503,
      'PUSH_NOT_CONFIGURED',
      'Le notifiche non sono temporaneamente disponibili.',
    );
  }

  return { privateKey, publicKey, subject };
}

function configureVapid() {
  const config = getVapidConfig();
  if (!vapidConfigured) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    vapidConfigured = true;
  }
  return config;
}

function getStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return undefined;
  const statusCode = error.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function getVapidPublicKey() {
  return getVapidConfig().publicKey;
}

export async function sendLessonPush({
  admin,
  body,
  coachId,
  lessonId,
  teamId,
  title,
}: LessonPushInput) {
  configureVapid();

  const { data, error } = await admin.rpc('list_push_notification_targets', {
    p_coach_id: coachId,
    p_lesson_id: lessonId,
    p_team_id: teamId,
  });

  if (error) {
    if (error.code === '42501') {
      throw new ApiError(403, 'COACH_ADMIN_REQUIRED', 'Operazione non autorizzata.');
    }
    if (error.code === '22023') {
      throw new ApiError(409, 'LESSON_NOT_ASSIGNED', 'La lezione non è assegnata.');
    }
    throw new ApiError(500, 'PUSH_TARGETS_FAILED', 'Destinatari non disponibili.');
  }

  const targets = (data ?? []) as PushTarget[];
  const payload = JSON.stringify({ body, lessonId, title, url: '/' });
  let deactivated = 0;
  let failed = 0;
  let sent = 0;

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { auth: target.auth_key, p256dh: target.p256dh },
          },
          payload,
          { TTL: 86_400, urgency: 'normal' },
        );
        sent += 1;
      } catch (sendError) {
        const statusCode = getStatusCode(sendError);
        if (statusCode === 404 || statusCode === 410) {
          const { data: wasDeactivated, error: deactivateError } = await admin.rpc(
            'deactivate_push_subscription_by_id',
            { p_subscription_id: target.subscription_id },
          );
          if (!deactivateError && wasDeactivated === true) deactivated += 1;
          return;
        }
        failed += 1;
      }
    }),
  );

  return { attempted: targets.length, deactivated, failed, sent };
}

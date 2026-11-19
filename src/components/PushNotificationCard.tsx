import { useEffect, useState } from 'react';
import { Bell, BellRing, CircleAlert, LoaderCircle, Smartphone } from 'lucide-react';

import {
  activatePushNotifications,
  getPushNotificationState,
  type PushNotificationState,
} from '../services/push-notifications';

export function PushNotificationCard() {
  const [state, setState] = useState<PushNotificationState>();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;
    void getPushNotificationState()
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch(() => {
        if (mounted) {
          setState({
            needsHomeScreen: false,
            permission: 'unsupported',
            subscribed: false,
            supported: false,
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activate = async () => {
    setActivating(true);
    setError(undefined);
    try {
      setState(await activatePushNotifications());
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'Attivazione delle notifiche non riuscita.',
      );
    } finally {
      setActivating(false);
    }
  };

  const isActive = state?.permission === 'granted' && state.subscribed;
  const isDenied = state?.permission === 'denied';
  const isUnsupported = state !== undefined && !state.supported;
  const needsHomeScreen = state?.needsHomeScreen === true;

  return (
    <section className="push-notification-card" aria-labelledby="push-card-title">
      <span className="push-notification-icon" aria-hidden="true">
        {isActive ? <BellRing className="size-5" /> : <Bell className="size-5" />}
      </span>
      <div className="push-notification-copy">
        <p className="section-kicker">Avvisi dal Coach</p>
        <h2 id="push-card-title">
          {isActive ? 'Notifiche attive' : 'Non perderti le nuove lezioni'}
        </h2>
        {needsHomeScreen ? (
          <p>
            <Smartphone className="size-4" aria-hidden="true" />
            Per ricevere le notifiche, apri ESORDIENTI ANALYST dalla schermata Home.
          </p>
        ) : isDenied ? (
          <p>
            <CircleAlert className="size-4" aria-hidden="true" />
            Le notifiche sono disattivate nelle impostazioni del dispositivo.
          </p>
        ) : isUnsupported ? (
          <p>
            <CircleAlert className="size-4" aria-hidden="true" />
            Le notifiche non sono supportate su questo dispositivo.
          </p>
        ) : isActive ? (
          <p>Riceverai un avviso quando il Coach assegna una nuova lezione.</p>
        ) : (
          <p>Attiva le notifiche e ti avviseremo quando il coach pubblica nuovi contenuti.</p>
        )}
        {error ? <p className="push-notification-error" role="alert">{error}</p> : null}
      </div>
      {!isActive && !isDenied && !isUnsupported && !needsHomeScreen ? (
        <button
          type="button"
          className="push-notification-action"
          disabled={activating || state === undefined}
          onClick={() => void activate()}
        >
          {activating ? (
            <LoaderCircle className="size-4 push-notification-spinner" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
          Attiva notifiche
        </button>
      ) : null}
      {isActive ? <span className="push-notification-active">Attive</span> : null}
    </section>
  );
}

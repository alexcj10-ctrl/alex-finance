import type { ReactNode } from 'react';

export function CoachPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="coach-page-header">
      <div>
        <p className="coach-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="coach-page-header-action">{action}</div> : null}
    </header>
  );
}

export function DemoDataBadge() {
  return (
    <span className="coach-demo-badge">
      <span aria-hidden="true" /> Dati dimostrativi
    </span>
  );
}

import React from 'react';

const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  pause: <><path d="M9 6v12" /><path d="M15 6v12" /></>,
  ban: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  plan: <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L8 21l4-2.2 4 2.2-1-7.5" /></>,
  planoff: <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L8 21l4-2.2 4 2.2-1-7.5" /><path d="M4 4l16 16" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  trash: <><path d="M5 7h14" /><path d="M10 7V5h4v2" /><path d="M7 7l1 13h8l1-13" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  undo: <><path d="M9 7L4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -6)" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  eyeoff: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><path d="M4 4l16 16" /></>,
};

export const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

/** A square icon button. The title shows on hover and is read by screen readers. */
export function IconBtn({ icon, title, onClick, tone, disabled }) {
  return (
    <button type="button" className={`icon-btn ${tone || ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
    </button>
  );
}

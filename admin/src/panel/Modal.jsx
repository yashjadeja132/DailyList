import React from 'react';

/** Simple dialog. Click outside or press Cancel to close. */
export default function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

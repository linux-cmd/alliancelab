import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X, ArrowUpRight, ChevronRight, Inbox } from 'lucide-react';

export function IconMark({ small = false }: { small?: boolean }) {
  return <span className={'brand-mark ' + (small ? 'small' : '')} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 25 13 7h6l8 18h-6l-5-12-5 12Z" fill="currentColor"/><path d="m11 21 5-3 5 3-5 3Z" fill="#fff"/></svg></span>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-actions">{action}</div>}</div>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><span className="empty-icon"><Inbox size={27}/></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); const close = () => closeRef.current(); dialog.addEventListener('cancel', close); return () => { dialog.removeEventListener('cancel', close); dialog.close(); }; }, []);
  return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
export function Confirm({ title, description, onConfirm, onClose, label = 'Delete', danger = true }: { title: string; description: string; onConfirm: () => void; onClose: () => void; label?: string; danger?: boolean }) {
  return <Modal title={title} onClose={onClose}><p className="muted">{description}</p><div className="form-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className={'button ' + (danger ? 'danger' : 'primary')} onClick={() => { onConfirm(); onClose(); }}>{label}</button></div></Modal>;
}
export function Stat({ label, value, detail, icon }: { label: string; value: ReactNode; detail: string; icon?: ReactNode }) {
  return <div className="stat"><div className="stat-label">{label}{icon}</div><strong>{value}</strong><span>{detail}</span></div>;
}
export function PanelTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
export function Tag({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={'tag ' + tone}>{children}</span>; }
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>; }
export function Breadcrumb({ children }: { children: ReactNode }) { return <div className="breadcrumb">Workspace<ChevronRight size={13}/>{children}</div>; }
export const fmt = (value: number, digits = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

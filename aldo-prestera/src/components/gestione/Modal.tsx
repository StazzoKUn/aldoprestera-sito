import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/** Finestra di dialogo del pannello (si apre da sola, si chiude con Esc o con onClose) */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} class="g-modal" onClose={onClose} onCancel={onClose} aria-labelledby="g-modal-title">
      <div class="g-modal__body">
        <h2 id="g-modal-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const MENU_WIDTH = 160;

/**
 * The "⋮" button at the end of a table row. Clicking it opens a small pop-up
 * menu of actions without triggering the row's own click. The menu is rendered
 * in a portal so the table's scroll container can't clip it.
 *
 * items: [{ label, to?, onClick?, danger? }]
 */
export default function RowActions({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Place the menu under the button, flipping above it near the bottom of the
  // screen. Re-placed on scroll/resize so it stays attached to its button.
  const place = useCallback(() => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
      setOpen(false);
      return;
    }
    const menuHeight = menuRef.current?.offsetHeight || items.length * 40 + 8;
    const below = r.bottom + 4;
    const top = below + menuHeight > window.innerHeight - 8 ? Math.max(r.top - menuHeight - 4, 8) : below;
    const left = Math.min(Math.max(r.right - MENU_WIDTH, 8), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top, left });
  }, [items.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const itemClass = (danger) =>
    cn(
      'block w-full px-3.5 py-2 text-left text-sm',
      danger
        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-navy'
    );

  return (
    // Clicks here (and in the portal, which bubbles through React) must not open the row.
    <div className="inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy',
          open && 'bg-slate-100 text-slate-600 dark:bg-navy'
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH }}
            className="fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-slate-700 dark:bg-navy-light"
          >
            {items.map((item) =>
              item.to ? (
                <Link key={item.label} role="menuitem" to={item.to} className={itemClass(item.danger)} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  type="button"
                  className={itemClass(item.danger)}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.label}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

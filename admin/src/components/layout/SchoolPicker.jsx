import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { listSchools } from '../../api/superadmin.js';
import { useViewSchoolStore } from '../../store/viewSchoolStore.js';
import Badge from '../ui/Badge.jsx';
import Spinner from '../ui/Spinner.jsx';
import { cn } from '../../lib/utils.js';

export const useSchoolList = () =>
  useQuery({ queryKey: ['superadmin', 'schools'], queryFn: listSchools, select: (d) => d.schools || [] });

/** List of schools to pick from; shared by the top-bar picker and the "choose a school" screen. */
export function SchoolList({ onPick, current, className }) {
  const { data: schools = [], isLoading, isError } = useSchoolList();
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? schools.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(t)) : schools;
  }, [schools, q]);

  if (isLoading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (isError) return <p className="px-4 py-6 text-sm text-red-600">Couldn&apos;t load the schools.</p>;
  if (!schools.length) return <p className="px-4 py-6 text-sm text-slate-500">No schools yet. Create one on the Platform page.</p>;

  return (
    <div className={className}>
      {schools.length > 6 && (
        <div className="relative mb-2 px-3 pt-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 mt-1.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search schools"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-navy dark:text-slate-100"
          />
        </div>
      )}
      <div className="max-h-72 overflow-y-auto py-1">
        {shown.map((s) => {
          const id = String(s._id || s.id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick({ id, name: s.name })}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{s.name}</span>
                <span className="block text-xs text-slate-400">{s.code}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {s.status !== 'Active' && <Badge>{s.status}</Badge>}
                {current === id && <Check className="h-4 w-4 text-brand-600" />}
              </span>
            </button>
          );
        })}
        {!shown.length && <p className="px-4 py-3 text-sm text-slate-500">No school matches “{q}”.</p>}
      </div>
    </div>
  );
}

/** Superadmin only: top-bar control showing which school the school pages are showing. */
export default function SchoolPicker() {
  const school = useViewSchoolStore((s) => s.school);
  const setSchool = useViewSchoolStore((s) => s.setSchool);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (s) => {
    setOpen(false);
    setSchool(s);
    if (pathname.startsWith('/platform')) navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={school ? `Viewing ${school.name}` : 'Choose a school to view'}
        className={cn(
          'flex h-10 max-w-[11rem] items-center gap-2 rounded-full border px-3 text-sm font-semibold sm:max-w-[16rem]',
          school
            ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">{school ? school.name : 'Choose a school'}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-x-4 top-20 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 dark:border-slate-700 dark:bg-navy-light">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Viewing school</p>
            <p className="text-xs text-slate-400">The school pages (Dashboard, Students, Live Tracking, ...) show this school only.</p>
          </div>
          <SchoolList onPick={pick} current={school?.id} />
          {school && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSchool(null);
                navigate('/platform');
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-navy"
            >
              <X className="h-4 w-4" /> Stop viewing {school.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Home, Search, Users } from 'lucide-react';
import Input from '../ui/Input.jsx';
import { getStudentOptions } from '../../api/students.js';

const studentLabel = (s) => `${s.firstName} ${s.lastName}`;

function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function StudentRow({ student, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(student)}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{studentLabel(student)}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {[student.studentCode, student.classGrade].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="truncate text-right text-xs text-slate-400">
        {student.homeAddress || (student.lat != null ? `${student.lat}, ${student.lng}` : 'No location set')}
      </span>
    </button>
  );
}

/**
 * Lets the admin pick a sibling or neighbour whose home location this student
 * should share. Siblings (same guardian) are suggested first when guardianId is set.
 */
export default function HouseholdLinkPicker({ guardianId, excludeId, onSelect }) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);

  const { data: siblings = [] } = useQuery({
    queryKey: ['student-options', 'siblings', guardianId, excludeId],
    queryFn: () => getStudentOptions({ guardian: guardianId, exclude: excludeId }),
    enabled: Boolean(guardianId),
    // Re-check on the client: an older server ignores the guardian filter and
    // would otherwise make every student look like a sibling.
    select: (list) =>
      list.filter((s) => String(s.primaryGuardian) === String(guardianId) && String(s._id) !== String(excludeId)),
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['student-options', 'search', q, excludeId],
    queryFn: () => getStudentOptions({ q, exclude: excludeId }),
    enabled: q.length >= 2,
  });

  return (
    <div className="space-y-3">
      {siblings.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
            <Users className="h-3.5 w-3.5" />
            Siblings found (same parent/guardian)
          </p>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => onSelect(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-navy dark:text-green-400"
              >
                <Home className="h-3.5 w-3.5" />
                Use {studentLabel(s)}&apos;s home
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Input
          icon={Search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a sibling or neighbour by name or student ID…"
        />
        {q.length >= 2 && (
          <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-navy-light">
            {isFetching && results.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">Searching…</p>}
            {!isFetching && results.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No students found</p>}
            {results.map((s) => (
              <StudentRow
                key={s._id}
                student={s}
                onSelect={(picked) => {
                  setQuery('');
                  onSelect(picked);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

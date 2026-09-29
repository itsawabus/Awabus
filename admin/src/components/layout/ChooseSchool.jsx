import { Building2 } from 'lucide-react';
import Card from '../ui/Card.jsx';
import { SchoolList } from './SchoolPicker.jsx';
import { useViewSchoolStore } from '../../store/viewSchoolStore.js';
import usePageHeader from '../../hooks/usePageHeader.js';

/** Shown to a superadmin on a school page before a school has been chosen. */
export default function ChooseSchool() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Choose a school'] });
  const setSchool = useViewSchoolStore((s) => s.setSchool);
  return (
    <Card className="mx-auto max-w-lg overflow-hidden">
      <div className="flex flex-col items-center px-6 pb-4 pt-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
          <Building2 className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Choose a school to view</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          As platform admin you can open any school&apos;s pages. You see one school at a time, and you can switch
          with the school button at the top.
        </p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800">
        <SchoolList onPick={setSchool} />
      </div>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, School as SchoolIcon } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Label, Select } from '../../components/ui/Input.jsx';
import GpsAddressInput from '../../components/ui/GpsAddressInput.jsx';
import GeofenceMap from '../../components/map/GeofenceMap.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { getMySchool, updateSchoolLocation } from '../../api/school.js';

const RADII = [100, 150, 200, 300, 500];

/**
 * School settings: where the school is (optional; creating a school never
 * asks for it). With it set, on the morning pick-up every child marked picked
 * up is marked "At school" by itself when the bus arrives.
 */
export default function SchoolSettings() {
  usePageHeader({ breadcrumb: ['AwaBus', 'School settings'] });
  const qc = useQueryClient();
  const { data: school, isLoading, error } = useQuery({ queryKey: ['my-school'], queryFn: getMySchool });
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (school && !form) {
      setForm({
        gpsAddress: school.gpsAddress || '',
        lat: school.lat ?? '',
        lng: school.lng ?? '',
        arrivalRadius: school.arrivalRadius || 150,
        autoAtSchool: school.autoAtSchool !== false,
      });
    }
  }, [school, form]);

  const save = useMutation({
    mutationFn: () =>
      updateSchoolLocation({
        gpsAddress: form.gpsAddress,
        ...(form.lat !== '' && form.lng !== '' ? { lat: Number(form.lat), lng: Number(form.lng) } : {}),
        arrivalRadius: Number(form.arrivalRadius),
        autoAtSchool: form.autoAtSchool,
      }),
    onSuccess: (data) => {
      qc.setQueryData(['my-school'], data);
      qc.invalidateQueries({ queryKey: ['tracking-overview'] });
    },
  });

  if (error) return <p className="py-10 text-center text-sm text-slate-500">{error.message}</p>;
  if (isLoading || !form) return <PageLoader />;
  const hasPoint = form.lat !== '' && form.lng !== '';
  const edit = (patch) => {
    save.reset();
    setForm((f) => ({ ...f, ...patch }));
  };

  return (
    <div>
      <PageHeader title="School settings" subtitle={`${school.name} · where the school is, so AwaBus knows when the bus has arrived.`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="School location (optional)" subtitle="Used to mark children at school automatically on the morning pick-up." />
          <CardBody className="space-y-5">
            <GpsAddressInput
              value={form.gpsAddress}
              onChange={(v) => edit({ gpsAddress: v })}
              onResolve={({ lat, lng }) => edit({ lat, lng })}
            />
            {hasPoint ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Latitude {Number(form.lat).toFixed(5)}, longitude {Number(form.lng).toFixed(5)}. Drag the pin on the map to the school gate if it
                needs moving.
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">Type the school&apos;s GPS address (e.g. GA-123-4567) to find it.</p>
            )}
            <div>
              <Label>Arrival zone</Label>
              <Select value={form.arrivalRadius} onChange={(e) => edit({ arrivalRadius: Number(e.target.value) })}>
                {[...new Set([...RADII, Number(form.arrivalRadius)])]
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <option key={r} value={r}>
                      {r} metres around the school
                    </option>
                  ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500">The bus counts as arrived once it is this close. Bigger for large compounds.</p>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-600"
                checked={form.autoAtSchool}
                onChange={(e) => edit({ autoAtSchool: e.target.checked })}
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Mark children &quot;At school&quot; automatically</span>
                <span className="block text-xs text-slate-500">
                  On the morning pick-up, when the bus arrives, every child marked picked up is marked at school and parents get the usual
                  text. The driver can still mark them by hand.
                </span>
              </span>
            </label>
            {save.isError && <p className="text-sm text-red-600">{save.error.message}</p>}
            {save.isSuccess && (
              <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Saved.
              </p>
            )}
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!hasPoint}>
              Save school location
            </Button>
          </CardBody>
        </Card>
        <Card className="overflow-hidden">
          <div className="h-[420px]">
            {hasPoint ? (
              <GeofenceMap lat={form.lat} lng={form.lng} radius={form.arrivalRadius} onMove={(lat, lng) => edit({ lat, lng })} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
                <SchoolIcon className="h-8 w-8" />
                The map appears once the school is found.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

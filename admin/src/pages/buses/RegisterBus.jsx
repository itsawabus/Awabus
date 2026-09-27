import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Route as RouteIcon } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useCreateDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx';
import { CAPACITY_MAX, capacityError, digitsOnly, formatPlate, plateError } from '../../lib/formats.js';
import { getRouteOptions } from '../../api/routes.js';
import { createBus } from '../../api/buses.js';

const initial = { plateNumber: '', name: '', type: 'Standard', capacity: '', assignedRoute: null };

export default function RegisterBus() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Buses', 'Register Bus'] });
  const queryClient = useQueryClient();
  const [form, setForm, draft] = useCreateDraft('bus:new', initial);
  const [created, setCreated] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [errors, setErrors] = useState({});
  const set = (key) => (val) => {
    setErrors((e) => ({ ...e, [key]: '' }));
    setForm((f) => ({ ...f, [key]: val }));
  };

  const { data: routeOptions, isLoading: routesLoading } = useQuery({ queryKey: ['route-options'], queryFn: getRouteOptions });

  const mutation = useMutation({
    mutationFn: (payload) => createBus(payload),
    onSuccess: (bus) => {
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      setCreated(bus);
      draft.clear();
    },
  });

  if (routesLoading) return <PageLoader />;

  // Buses must belong to a route (routes are created first), so there's
  // nothing meaningful to register a bus against until at least one exists.
  if (!created && (routeOptions || []).length === 0) {
    return (
      <div>
        <PageHeader title="Register Bus" />
        <Card>
          <EmptyState
            icon={RouteIcon}
            title="No routes yet"
            description="A bus has to be assigned to a route, so create a route first before registering a bus."
            action={
              <Button as={Link} to="/routes/new">
                Create a route
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (created) {
    return (
      <div>
        <PageHeader title="Register Bus" />
        <Card className="mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-brand-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Bus Registered Successfully</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The new vehicle has been added to the AwaBus school fleet records.
          </p>
          <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm dark:bg-navy">
            <Row label="Plate Number" value={created.plateNumber} />
            <Row label="Bus Nickname" value={created.name} />
            <Row label="Capacity" value={`${created.capacity} Seats`} />
            <Row label="Assigned Route" value={created.assignedRoute?.name || '—'} />
          </div>
          <p className="mt-4 text-xs text-slate-400">Next, assign a driver to this bus from the Drivers page.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button as={Link} to="/buses" variant="outline">
              Back to Bus List
            </Button>
            <Button as={Link} to={`/buses/${created._id}`}>
              View Bus Profile
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setRouteError('');
    if (!form.assignedRoute) {
      setRouteError('Select the route this bus will service');
      return;
    }
    const next = { plateNumber: plateError(form.plateNumber), capacity: capacityError(form.capacity), name: form.name.trim() ? '' : 'Bus name is required' };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    mutation.mutate({ ...form, capacity: Number(form.capacity) });
  };

  return (
    <div>
      <Link to="/buses" className="mb-3 inline-block text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
        ← Back to Bus List
      </Link>
      <PageHeader title="Register Bus" />
      <DraftNotice show={draft.restored} onDiscard={draft.clear} />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Vehicle Information" />
          {mutation.error && (
            <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {mutation.error.message}
            </div>
          )}
          <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label required>Bus Plate Number</Label>
              <Input value={form.plateNumber} onChange={(e) => set('plateNumber')(formatPlate(e.target.value))} error={Boolean(errors.plateNumber)} placeholder="e.g. GC-102-21" required />
              <FieldError>{errors.plateNumber}</FieldError>
              {!errors.plateNumber && <p className="mt-1.5 text-xs text-slate-400">Format: region letters, number, year, e.g. GR-1234-20</p>}
            </div>
            <div>
              <Label required>Bus Name/Nickname</Label>
              <Input value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="e.g. Bus A / Yellow Submarine" required />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label required>Capacity (Seats)</Label>
              <Input inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity')(digitsOnly(e.target.value, 3))} error={Boolean(errors.capacity)} placeholder={`e.g. 45 (max ${CAPACITY_MAX})`} required />
              <FieldError>{errors.capacity}</FieldError>
            </div>
            <div>
              <Label required>Assigned Route</Label>
              <SearchableSelect
                placeholder="Select the route this bus will service"
                value={form.assignedRoute}
                onChange={(val) => {
                  set('assignedRoute')(val);
                  setRouteError('');
                }}
                error={Boolean(routeError)}
                options={routeOptions.map((r) => ({
                  value: r._id,
                  label: `${r.routeId} - ${r.name}`,
                  disabled: Boolean(r.assignedBus),
                  description: r.assignedBus ? `Already served by ${r.assignedBus.name}` : 'No bus yet',
                }))}
              />
              <FieldError>{routeError}</FieldError>
            </div>
          </CardBody>

          <div className="flex justify-end gap-3 border-t border-slate-100 p-5 dark:border-slate-800">
            <Button as={Link} to="/buses" variant="outline" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Register Bus
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0 dark:border-slate-800">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-semibold text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useEditDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx';
import { CAPACITY_MAX, capacityError, digitsOnly, formatPlate, ifChanged, plateError } from '../../lib/formats.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { UNDO_SECONDS, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import { getBus, updateBus } from '../../api/buses.js';
import { getRouteOptions } from '../../api/routes.js';

export default function EditBus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [routeError, setRouteError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['bus', id], queryFn: () => getBus(id) });
  const { data: routeOptions = [] } = useQuery({ queryKey: ['route-options'], queryFn: getRouteOptions });
  usePageHeader({
    breadcrumb: ['AwaBus', 'Buses', { label: data?.data?.plateNumber || '...', to: `/buses/${id}` }, 'Edit'],
  });

  const baseline = useMemo(() => {
    const bus = data?.data;
    if (!bus) return null;
    return {
      plateNumber: bus.plateNumber,
      name: bus.name,
      capacity: bus.capacity,
      assignedRoute: bus.assignedRoute?._id || null,
      status: bus.status,
    };
  }, [data]);
  // Unsaved edits are kept as a draft until saved or discarded.
  const [form, setForm, draft] = useEditDraft(`bus:${id}`, baseline);

  const [errors, setErrors] = useState({});
  const set = (key) => (val) => {
    setErrors((e) => ({ ...e, [key]: '' }));
    setForm((f) => ({ ...f, [key]: val }));
  };

  const updateMutation = useMutation({
    mutationFn: (payload) => updateBus(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      draft.clear();
      queryClient.invalidateQueries({ queryKey: ['bus', id] });
      navigate(`/buses/${id}`);
    },
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  // The delete waits out the undo time (see undoDeleteStore); the list hides it meanwhile.
  const deleteWithUndo = () => {
    const label = `${data.data.plateNumber} (${data.data.name})`;
    scheduleDelete({
      title: label,
      items: [{ id, label, path: `/buses/${id}` }],
      onFinished: () =>
        Promise.all([...['buses', 'routes', 'drivers', 'bus-options'], 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    });
    navigate('/buses');
  };

  if (isLoading || !form) return <PageLoader />;
  const bus = data.data;

  const handleSubmit = (e) => {
    e.preventDefault();
    setRouteError('');
    if (!form.assignedRoute) {
      setRouteError('A bus must remain assigned to a route');
      return;
    }
    const next = {
      plateNumber: ifChanged(form.plateNumber, baseline.plateNumber, () => plateError(form.plateNumber)),
      capacity: ifChanged(form.capacity, baseline.capacity, () => capacityError(form.capacity)),
      name: form.name.trim() ? '' : 'Bus name is required',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    updateMutation.mutate({ ...form, capacity: Number(form.capacity) });
  };

  return (
    <div>
      <PageHeader title={`Edit Bus ${bus.plateNumber}`} />
      <DraftNotice show={draft.restored} onDiscard={draft.discard} discardLabel="Discard changes" />
      <form noValidate onSubmit={handleSubmit}>
        <Card>
          {updateMutation.error && (
            <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {updateMutation.error.message}
            </div>
          )}
          <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label required>Bus Plate Number</Label>
              <Input value={form.plateNumber} onChange={(e) => set('plateNumber')(formatPlate(e.target.value))} error={Boolean(errors.plateNumber)} />
              <FieldError>{errors.plateNumber}</FieldError>
              {!errors.plateNumber && <p className="mt-1.5 text-xs text-slate-400">Format: region letters, number, year, e.g. GR-1234-20</p>}
            </div>
            <div>
              <Label required>Bus Name/Nickname</Label>
              <Input value={form.name} onChange={(e) => set('name')(e.target.value)} />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label required>Capacity (Seats)</Label>
              <Input inputMode="numeric" value={form.capacity} onChange={(e) => set('capacity')(digitsOnly(e.target.value, 3))} error={Boolean(errors.capacity)} />
              <FieldError>{errors.capacity}</FieldError>
            </div>
            <div>
              <Label>Fleet Status</Label>
              <Select value={form.status} onChange={(e) => set('status')(e.target.value)}>
                <option>Active</option>
                <option>Idle</option>
                <option>Maintenance</option>
              </Select>
            </div>
            <div>
              <Label required>Assigned Route</Label>
              <SearchableSelect
                placeholder="Select route"
                value={form.assignedRoute}
                onChange={(val) => {
                  set('assignedRoute')(val);
                  setRouteError('');
                }}
                error={Boolean(routeError)}
                options={routeOptions.map((r) => {
                  const taken = Boolean(r.assignedBus) && r.assignedBus._id !== id;
                  return {
                    value: r._id,
                    label: `${r.routeId} - ${r.name}`,
                    disabled: taken,
                    description: taken ? `Already served by ${r.assignedBus.name}` : undefined,
                  };
                })}
              />
              <FieldError>{routeError}</FieldError>
            </div>
          </CardBody>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm font-semibold text-red-600 hover:underline"
            >
              Delete Bus from Fleet
            </button>
            <div className="flex gap-3">
              <Button as={Link} to={`/buses/${id}`} variant="outline" type="button">
                Cancel
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this bus?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteWithUndo}>
              Delete Bus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;ll have {UNDO_SECONDS} seconds to undo. After that it&apos;s permanent.</p>
      </Modal>
    </div>
  );
}

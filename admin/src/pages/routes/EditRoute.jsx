import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useEditDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import RouteForm from './RouteForm.jsx';
import { getRoute, updateRoute } from '../../api/routes.js';

export default function EditRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: route, isLoading } = useQuery({ queryKey: ['route', id], queryFn: () => getRoute(id) });
  usePageHeader({ breadcrumb: ['AwaBus', 'Routes', route?.name || 'Edit route', 'Edit'] });

  const baseline = useMemo(() => (route ? { name: route.name } : null), [route]);
  // Unsaved edits are kept as a draft until saved or discarded.
  const [values, setValues, draft] = useEditDraft(`route:${id}`, baseline);

  const mutation = useMutation({
    mutationFn: (payload) => updateRoute(id, payload),
    onSuccess: () => {
      draft.clear();
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      navigate('/routes');
    },
  });

  if (isLoading || !values) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Edit route" subtitle="Modify this route's name and status." />
      <DraftNotice show={draft.restored} onDiscard={draft.discard} discardLabel="Discard changes" />

      <Card className="mb-6">
        <CardHeader title="Current assignments" subtitle="Managed from the Buses/Drivers/Students pages, not here." />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SummaryStat label="Assigned bus" value={route.assignedBus ? `${route.assignedBus.name} (${route.assignedBus.plateNumber})` : 'Not assigned yet'} />
          <SummaryStat
            label="Assigned driver"
            value={route.assignedDriver ? `${route.assignedDriver.firstName} ${route.assignedDriver.lastName}` : 'Not assigned yet'}
          />
          <SummaryStat label="Students on route" value={route.studentCount ?? route.students?.length ?? 0} />
        </CardBody>
      </Card>

      <RouteForm
        mode="edit"
        values={values}
        onChange={setValues}
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(values);
        }}
        submitting={mutation.isPending}
        routeIdDisplay={route.routeId}
        error={mutation.error?.message}
      />
    </div>
  );
}

const SummaryStat = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

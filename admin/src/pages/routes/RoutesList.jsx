import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, Milestone, SearchX, CircleCheck, Bus as BusIcon, GraduationCap } from 'lucide-react';
import StatCard from '../../components/ui/StatCard.jsx';
import usePageHeader from '../../hooks/usePageHeader.js';
import useDebounce from '../../hooks/useDebounce.js';
import { getRoutes, updateRoute } from '../../api/routes.js';
import Card from '../../components/ui/Card.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';
import RowActions from '../../components/ui/RowActions.jsx';
import BulkUploadModal from '../../components/import/BulkUploadModal.jsx';
import useListSelection from '../../hooks/useListSelection.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { ROUTE_STATUSES } from '../../lib/options.js';
import { UNDO_SECONDS, usePendingDeleteIds, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { formatRunTime } from '../../lib/sessions.js';

export default function RoutesList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  usePageHeader({
    breadcrumb: ['AwaBus', 'Routes'],
    searchPlaceholder: 'Search routes, buses, students...',
    searchValue: search,
    onSearchChange: (v) => {
      setSearch(v);
      setPage(1);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['routes', page, debouncedSearch],
    queryFn: () => getRoutes({ page, q: debouncedSearch }),
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  const pendingIds = usePendingDeleteIds();

  // Items waiting out their undo time are hidden already.
  const routes = (data?.data || []).filter((item) => !pendingIds.has(item._id));
  const getLabel = (r) => `${r.routeId} - ${r.name}`;
  const invalidate = ['routes', 'route-options'];
  const selection = useListSelection({
    items: routes,
    getLabel,
    deletePath: (id) => `/routes/${id}`,
    noun: 'routes',
    singular: 'route',
    invalidate,
    bulkEdit: {
      updateOne: updateRoute,
      fields: [
        { key: 'status', label: 'Status', type: 'select', options: ROUTE_STATUSES, get: (r) => r.status || '' },
        {
          key: 'morningStartTime',
          label: 'Morning pick-up starts',
          type: 'time',
          get: (r) => formatRunTime(r.morningStartTime),
          validate: (v) => (v && v >= '12:00' ? 'Must be before 12:00 noon' : ''),
          hint: 'Leave empty to clear it.',
        },
        {
          key: 'eveningStartTime',
          label: 'Afternoon drop-off starts',
          type: 'time',
          get: (r) => formatRunTime(r.eveningStartTime),
          validate: (v) => (v && v < '12:00' ? 'Must be 12:00 noon or later' : ''),
          hint: 'Leave empty to clear it.',
        },
      ],
    },
  });
  const confirmDelete = (item) => {
    scheduleDelete({
      title: getLabel(item),
      items: [{ id: item._id, label: getLabel(item), path: `/routes/${item._id}` }],
      onFinished: () =>
        Promise.all([...invalidate, 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    });
    setDeleteTarget(null);
  };
  const meta = data?.meta;
  const stats = data?.stats || {};
  const hasAnyRoutes = meta && (meta.total > 0 || debouncedSearch);

  return (
    <div>
      <PageHeader
        title="Routes"
        subtitle="Manage operational lines, assign drivers, and monitor service capacity."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Routes" value={stats.totalRoutes ?? 0} hint="Lines your buses run" icon={Milestone} />
        <StatCard label="Active Routes" value={stats.active ?? 0} hint="Currently in service" icon={CircleCheck} />
        <StatCard label="Routes Without a Bus" value={stats.withoutBus ?? 0} hint="Need a bus assigned" icon={BusIcon} tone="amber" />
        <StatCard label="Students on Routes" value={stats.studentsOnRoutes ?? 0} hint="Students assigned to a route" icon={GraduationCap} tone="slate" />
      </div>

      <ListToolbar left={meta ? <p className="text-sm text-slate-500 dark:text-slate-400">{meta.total} routes</p> : null}>
        {selection.toolbarButton}
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" /> Bulk upload
        </Button>
        <Button as={Link} to="/routes/new">
          <Plus className="h-4 w-4" /> Add Route
        </Button>
      </ListToolbar>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : routes.length === 0 ? (
          debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              title="No routes match your search"
              description={`We couldn't find any operational lines matching "${debouncedSearch}". Please double-check your spelling or try different search terms.`}
              action={
                <Button variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Milestone}
              title="No routes yet"
              description="Create your first operational bus route to start onboarding students and assigning drivers."
              action={
                <Button as={Link} to="/routes/new">
                  <Plus className="h-4 w-4" /> Add Route
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <Thead>
                {selection.headerCell}
                <Th>Route ID</Th>
                <Th>Route Name</Th>
                <Th>Assigned Driver</Th>
                <Th>Students</Th>
                <Th>Stops</Th>
                <Th>Runs</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <Tbody>
                {routes.map((route) => (
                  <Tr key={route._id} {...selection.rowProps(route, () => navigate(`/routes/${route._id}/edit`))}>
                    {selection.cell(route)}
                    <Td className="font-bold text-slate-900 dark:text-white">{route.routeId}</Td>
                    <Td>{route.name}</Td>
                    <Td>
                      {route.assignedDriver
                        ? `${route.assignedDriver.firstName} ${route.assignedDriver.lastName}`
                        : '—'}
                    </Td>
                    <Td>{route.studentCount ?? route.students?.length ?? 0}</Td>
                    <Td>{route.stops?.length ? route.stops.length : <span className="text-amber-600 dark:text-amber-400">None yet</span>}</Td>
                    <Td className="whitespace-nowrap text-sm">
                      {route.morningStartTime || route.eveningStartTime ? (
                        <>
                          <span className="block">Pick-up {formatRunTime(route.morningStartTime, '—')}</span>
                          <span className="block text-slate-500 dark:text-slate-400">Drop-off {formatRunTime(route.eveningStartTime, '—')}</span>
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Not set</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={route.status === 'Active' ? 'success' : 'neutral'}>{route.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <RowActions
                        items={[
                          { label: 'Edit route', to: `/routes/${route._id}/edit` },
                          { label: 'Delete route', danger: true, onClick: () => setDeleteTarget(route) },
                        ]}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {meta && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onChange={setPage}
                label={`Showing ${routes.length ? (meta.page - 1) * meta.limit + 1 : 0} to ${
                  (meta.page - 1) * meta.limit + routes.length
                } of ${meta.total} routes`}
              />
            )}
          </>
        )}
      </Card>
      {selection.bar}
      {selection.dialog}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this route?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete(deleteTarget)}>
              Delete Route
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          You'll have {UNDO_SECONDS} seconds to undo. After that it's permanent.
        </p>
        {deleteTarget && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm dark:bg-navy">
            <div className="flex justify-between">
              <span className="text-slate-500">Route ID</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{deleteTarget.routeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Route Name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{deleteTarget.name}</span>
            </div>
          </div>
        )}
      </Modal>
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} entity="routes" label="Routes" singular="route" />
    </div>
  );
}

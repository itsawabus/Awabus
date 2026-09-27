import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, Bus as BusIcon, SearchX, Settings2, Ban } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import useDebounce from '../../hooks/useDebounce.js';
import { getBuses, updateBus } from '../../api/buses.js';
import Card from '../../components/ui/Card.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';
import RowActions from '../../components/ui/RowActions.jsx';
import BulkUploadModal from '../../components/import/BulkUploadModal.jsx';
import useListSelection from '../../hooks/useListSelection.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { BUS_STATUSES, BUS_TYPES } from '../../lib/options.js';
import { CAPACITY_MAX, CAPACITY_MIN, capacityError } from '../../lib/formats.js';
import { UNDO_SECONDS, usePendingDeleteIds, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';

const STATUS_TABS = ['All', 'Active', 'Idle', 'Maintenance'];

export default function BusesList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  usePageHeader({
    breadcrumb: ['AwaBus', 'Buses'],
    searchPlaceholder: 'Search by plate number or bus...',
    searchValue: search,
    onSearchChange: (v) => {
      setSearch(v);
      setPage(1);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['buses', page, debouncedSearch, status],
    queryFn: () => getBuses({ page, q: debouncedSearch, status }),
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  const pendingIds = usePendingDeleteIds();

  // Items waiting out their undo time are hidden already.
  const buses = (data?.data || []).filter((item) => !pendingIds.has(item._id));
  const getLabel = (b) => `${b.plateNumber} (${b.name})`;
  const invalidate = ['buses', 'routes', 'drivers', 'bus-options'];
  const selection = useListSelection({
    items: buses,
    getLabel,
    deletePath: (id) => `/buses/${id}`,
    noun: 'buses',
    singular: 'bus',
    invalidate,
    bulkEdit: {
      updateOne: updateBus,
      fields: [
      { key: 'status', label: 'Status', type: 'select', options: BUS_STATUSES, get: (b) => b.status || '' },
      { key: 'type', label: 'Bus type', type: 'select', options: BUS_TYPES, get: (b) => b.type || '' },
      {
        key: 'capacity',
        label: 'Capacity (seats)',
        type: 'number',
        get: (b) => b.capacity ?? '',
        validate: (v) => capacityError(v),
        hint: `Whole number from ${CAPACITY_MIN} to ${CAPACITY_MAX}.`,
      },
    ],
    },
  });
  const confirmDelete = (item) => {
    scheduleDelete({
      title: getLabel(item),
      items: [{ id: item._id, label: getLabel(item), path: `/buses/${item._id}` }],
      onFinished: () =>
        Promise.all([...invalidate, 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    });
    setDeleteTarget(null);
  };
  const meta = data?.meta;
  const stats = data?.stats || {};

  return (
    <div className={selection.selecting ? 'pb-24' : undefined}>
      <PageHeader
        title="Buses"
        subtitle="Register, assign and manage every vehicle in the school fleet."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Registered Buses" value={stats.totalBuses ?? 0} hint="Active school vehicles" icon={BusIcon} />
        <StatCard label="Buses in Maintenance" value={stats.maintenance ?? 0} hint="Overdue for inspection" icon={Settings2} tone="amber" />
        <StatCard label="Idle Buses" value={stats.idle ?? 0} hint="Available for assignment" icon={Ban} tone="slate" />
      </div>

      <ListToolbar
        left={
          <PillTabs
            tabs={STATUS_TABS}
            active={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        }
      >
        {selection.toolbarButton}
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" /> Bulk upload
        </Button>
        <Button as={Link} to="/buses/new">
          <Plus className="h-4 w-4" /> Register Bus
        </Button>
      </ListToolbar>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : buses.length === 0 ? (
          debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              title="No buses match the search"
              description={`We couldn't find any bus with details matching "${debouncedSearch}". Check spelling or clear search filters.`}
              action={
                <Button variant="outline" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={BusIcon}
              title="No buses registered yet"
              description="Get started by registering the first bus in your school fleet to assign routes and drivers."
              action={
                <Button as={Link} to="/buses/new">
                  <Plus className="h-4 w-4" /> Register Bus
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <Thead>
                {selection.headerCell}
                <Th>Bus Plate No</Th>
                <Th>Bus Name</Th>
                <Th>Route</Th>
                <Th>Status</Th>
                <Th>Driver</Th>
                <Th>Capacity</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <Tbody>
                {buses.map((bus) => (
                  <Tr key={bus._id} {...selection.rowProps(bus, () => navigate(`/buses/${bus._id}`))}>
                    {selection.cell(bus)}
                    <Td className="font-bold text-slate-900 dark:text-white">{bus.plateNumber}</Td>
                    <Td>{bus.name}</Td>
                    <Td>{bus.assignedRoute ? `${bus.assignedRoute.name}` : '—'}</Td>
                    <Td>
                      <Badge>{bus.status}</Badge>
                    </Td>
                    <Td>{bus.assignedDriver ? `${bus.assignedDriver.firstName} ${bus.assignedDriver.lastName}` : '—'}</Td>
                    <Td>
                      {bus.seatsFilled ?? 0} / {bus.capacity}
                    </Td>
                    <Td className="text-right">
                      <RowActions
                        items={[
                          { label: 'Edit Bus', to: `/buses/${bus._id}/edit` },
                          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(bus) },
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
                label={`Showing ${(meta.page - 1) * meta.limit + 1}-${
                  (meta.page - 1) * meta.limit + buses.length
                } of ${meta.total} buses`}
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
        title="Delete this bus?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete(deleteTarget)}>
              Delete Bus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You'll have {UNDO_SECONDS} seconds to undo. After that it's permanent. {deleteTarget?.plateNumber} will be unassigned from its route and driver.
        </p>
      </Modal>
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} entity="buses" label="Buses" singular="bus" />
    </div>
  );
}

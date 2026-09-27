import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, Users, SearchX, UserCheck, Bus as BusIcon, IdCard } from 'lucide-react';
import StatCard from '../../components/ui/StatCard.jsx';
import usePageHeader from '../../hooks/usePageHeader.js';
import useDebounce from '../../hooks/useDebounce.js';
import { getDrivers, updateDriver } from '../../api/drivers.js';
import Card from '../../components/ui/Card.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';
import RowActions from '../../components/ui/RowActions.jsx';
import BulkUploadModal from '../../components/import/BulkUploadModal.jsx';
import useListSelection from '../../hooks/useListSelection.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { DRIVER_STATUSES, LICENSE_CLASSES } from '../../lib/options.js';
import { UNDO_SECONDS, usePendingDeleteIds, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { formatPhone } from '../../lib/phone.js';

export default function DriversList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  usePageHeader({
    breadcrumb: ['AwaBus', 'Drivers'],
    searchPlaceholder: 'Search by name, license or route...',
    searchValue: search,
    onSearchChange: (v) => {
      setSearch(v);
      setPage(1);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, debouncedSearch],
    queryFn: () => getDrivers({ page, q: debouncedSearch }),
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  const pendingIds = usePendingDeleteIds();

  // Items waiting out their undo time are hidden already.
  const drivers = (data?.data || []).filter((item) => !pendingIds.has(item._id));
  const getLabel = (d) => `${d.firstName} ${d.lastName}`;
  const invalidate = ['drivers', 'buses', 'routes', 'bus-options', 'driver-options'];
  const selection = useListSelection({
    items: drivers,
    getLabel,
    deletePath: (id) => `/drivers/${id}`,
    noun: 'drivers',
    singular: 'driver',
    invalidate,
    bulkEdit: {
      updateOne: updateDriver,
      fields: [
      { key: 'status', label: 'Status', type: 'select', options: DRIVER_STATUSES, get: (d) => d.status || '' },
      { key: 'licenseClass', label: 'License class', type: 'select', options: LICENSE_CLASSES, get: (d) => d.licenseClass || '' },
    ],
    },
  });
  const confirmDelete = (item) => {
    scheduleDelete({
      title: getLabel(item),
      items: [{ id: item._id, label: getLabel(item), path: `/drivers/${item._id}` }],
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
        title="Drivers"
        subtitle="Manage and assign authorized drivers for the school fleet."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Drivers" value={stats.totalDrivers ?? 0} hint="Registered drivers" icon={Users} />
        <StatCard label="Active Drivers" value={stats.active ?? 0} hint="Status set to Active" icon={UserCheck} />
        <StatCard label="Without a Bus" value={stats.withoutBus ?? 0} hint="Need a bus before they can drive" icon={BusIcon} tone="slate" />
        <StatCard
          label="License Alerts"
          value={stats.licenseAlerts ?? 0}
          hint="Expired or expiring within 30 days"
          icon={IdCard}
          tone={stats.licenseAlerts ? 'red' : 'amber'}
        />
      </div>

      <ListToolbar left={meta ? <p className="text-sm text-slate-500 dark:text-slate-400">{meta.total} drivers</p> : null}>
        {selection.toolbarButton}
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" /> Bulk upload
        </Button>
        <Button as={Link} to="/drivers/new">
          <Plus className="h-4 w-4" /> Add Driver
        </Button>
      </ListToolbar>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : drivers.length === 0 ? (
          debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              title={`No drivers match "${debouncedSearch}"`}
              description="Check the plate number or name, or clear the search to see all drivers."
              action={
                <Button variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No drivers yet"
              description="Add your drivers to set up the AwaBus app. Add the bus and route info."
              action={
                <Button as={Link} to="/drivers/new">
                  <Plus className="h-4 w-4" /> Add Driver
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <Thead>
                {selection.headerCell}
                <Th>Driver Name</Th>
                <Th>Phone</Th>
                <Th>License No</Th>
                <Th>Assigned Bus</Th>
                <Th>Assigned Route</Th>
                <Th>Status</Th>
                <Th>Emergency Contact</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <Tbody>
                {drivers.map((driver) => (
                  <Tr key={driver._id} {...selection.rowProps(driver, () => navigate(`/drivers/${driver._id}`))}>
                    {selection.cell(driver)}
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={`${driver.firstName} ${driver.lastName}`} src={driver.profilePhotoUrl} size="sm" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {driver.firstName} {driver.lastName}
                        </span>
                      </div>
                    </Td>
                    <Td>{formatPhone(driver.phone)}</Td>
                    <Td>{driver.licenseNumber}</Td>
                    <Td>{driver.assignedBus ? `${driver.assignedBus.name} (${driver.assignedBus.plateNumber})` : '—'}</Td>
                    <Td>{driver.assignedRoute ? `${driver.assignedRoute.name}` : '—'}</Td>
                    <Td>
                      <Badge>{driver.status}</Badge>
                    </Td>
                    <Td>
                      {driver.emergencyContactName
                        ? `${driver.emergencyContactName} (${driver.emergencyContactRelation})`
                        : '—'}
                    </Td>
                    <Td className="text-right">
                      <RowActions
                        items={[
                          { label: 'Edit Info', to: `/drivers/${driver._id}/edit` },
                          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(driver) },
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
                  (meta.page - 1) * meta.limit + drivers.length
                } of ${meta.total} drivers`}
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
        title="Delete this driver?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete(deleteTarget)}>
              Delete Driver
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You'll have {UNDO_SECONDS} seconds to undo. After that it's permanent. {deleteTarget?.firstName} {deleteTarget?.lastName} will be
          unassigned from their bus and route.
        </p>
      </Modal>
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} entity="drivers" label="Drivers" singular="driver" />
    </div>
  );
}

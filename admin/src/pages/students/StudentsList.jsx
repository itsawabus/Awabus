import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, GraduationCap, SearchX, Users2, UserRound, UsersRound } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import useDebounce from '../../hooks/useDebounce.js';
import { getStudents, updateStudent } from '../../api/students.js';
import Card from '../../components/ui/Card.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';
import RowActions from '../../components/ui/RowActions.jsx';
import BulkUploadModal from '../../components/import/BulkUploadModal.jsx';
import useListSelection from '../../hooks/useListSelection.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { getRouteOptions } from '../../api/routes.js';
import { CLASS_GRADE_OPTIONS, STUDENT_STATUSES } from '../../lib/options.js';
import { RADIUS_MAX, RADIUS_MIN, radiusError } from '../../lib/formats.js';
import { UNDO_SECONDS, usePendingDeleteIds, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { formatPhone } from '../../lib/phone.js';

export default function StudentsList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  usePageHeader({
    breadcrumb: ['AwaBus', 'Students'],
    searchPlaceholder: 'Search students, routes or guardians...',
    searchValue: search,
    onSearchChange: (v) => {
      setSearch(v);
      setPage(1);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, debouncedSearch],
    queryFn: () => getStudents({ page, q: debouncedSearch }),
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  const pendingIds = usePendingDeleteIds();

  // Items waiting out their undo time are hidden already.
  const students = (data?.data || []).filter((item) => !pendingIds.has(item._id));
  const getLabel = (s) => `${s.firstName} ${s.lastName}`;
  const invalidate = ['students', 'routes'];
  const selection = useListSelection({
    items: students,
    getLabel,
    deletePath: (id) => `/students/${id}`,
    noun: 'students',
    singular: 'student',
    invalidate,
    bulkEdit: {
      updateOne: updateStudent,
      fields: [
      {
        key: 'route',
        label: 'Route',
        type: 'select',
        queryKey: 'route-options',
        loadOptions: () => getRouteOptions().then((rs) => rs.map((r) => ({ value: r._id, label: `${r.routeId} - ${r.name}` }))),
        get: (s) => s.route?._id || s.route || '',
        hint: 'Their bus changes to the bus that serves the new route.',
      },
      { key: 'classGrade', label: 'Class / Grade', type: 'select', options: CLASS_GRADE_OPTIONS, get: (s) => s.classGrade || '' },
      { key: 'pickupPoint', label: 'Pickup point', type: 'text', get: (s) => s.pickupPoint || '', validate: (v) => (v.length > 120 ? 'At most 120 characters' : '') },
      { key: 'dropoffPoint', label: 'Drop-off point', type: 'text', get: (s) => s.dropoffPoint || '', validate: (v) => (v.length > 120 ? 'At most 120 characters' : '') },
      {
        key: 'geofenceRadius',
        label: 'Geofence radius (metres)',
        type: 'number',
        get: (s) => s.geofenceRadius ?? '',
        validate: (v) => radiusError(v),
        hint: `Between ${RADIUS_MIN} and ${RADIUS_MAX} metres.`,
      },
      { key: 'status', label: 'Status', type: 'select', options: STUDENT_STATUSES, get: (s) => s.status || '' },
    ],
    },
  });
  const confirmDelete = (item) => {
    scheduleDelete({
      title: getLabel(item),
      items: [{ id: item._id, label: getLabel(item), path: `/students/${item._id}` }],
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
        title="Students"
        subtitle="Monitor child safe boarding status and details."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents ?? 0} hint="Active registrations" icon={GraduationCap} />
        <StatCard
          label="Male Students"
          value={stats.male ?? 0}
          hint={stats.totalStudents ? `${Math.round((stats.male / stats.totalStudents) * 100)}% of total` : ''}
          icon={UserRound}
          tone="slate"
        />
        <StatCard
          label="Female Students"
          value={stats.female ?? 0}
          hint={stats.totalStudents ? `${Math.round((stats.female / stats.totalStudents) * 100)}% of total` : ''}
          icon={Users2}
          tone="amber"
        />
        <StatCard label="Guardians Registered" value={stats.guardianCount ?? 0} hint="Active contacts" icon={UsersRound} />
      </div>

      <ListToolbar left={meta ? <p className="text-sm text-slate-500 dark:text-slate-400">{meta.total} students</p> : null}>
        {selection.toolbarButton}
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" /> Bulk upload
        </Button>
        <Button as={Link} to="/students/new">
          <Plus className="h-4 w-4" /> Add Student
        </Button>
      </ListToolbar>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : students.length === 0 ? (
          debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              title="No students match the search"
              description={`We couldn't find any registered student matching "${debouncedSearch}" in the system.`}
              action={
                <Button variant="outline" onClick={() => setSearch('')}>
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="No students yet"
              description="Enroll your school's students to start managing transit routes and geofence tracking."
              action={
                <Button as={Link} to="/students/new">
                  <Plus className="h-4 w-4" /> Enroll Your First Student
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <Thead>
                {selection.headerCell}
                <Th>Student Name</Th>
                <Th>Class</Th>
                <Th>Parent/Guardian</Th>
                <Th>Phone</Th>
                <Th>Assigned Bus</Th>
                <Th>Assigned Route</Th>
                <Th>Pickup Time</Th>
                <Th title="Today's status, from the driver's roll call and boarding scans">Today</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <Tbody>
                {students.map((s) => (
                  <Tr key={s._id} {...selection.rowProps(s, () => navigate(`/students/${s._id}`))}>
                    {selection.cell(s)}
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={`${s.firstName} ${s.lastName}`} src={s.profilePhotoUrl} size="sm" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {s.firstName} {s.lastName}
                        </span>
                      </div>
                    </Td>
                    <Td>{s.classGrade}</Td>
                    <Td>{s.primaryGuardian ? s.primaryGuardian.fullName || `${s.primaryGuardian.firstName} ${s.primaryGuardian.lastName}` : '—'}</Td>
                    <Td>{s.primaryGuardian?.phone ? formatPhone(s.primaryGuardian.phone) : '—'}</Td>
                    <Td>{s.bus?.plateNumber || s.bus?.name || '—'}</Td>
                    <Td>{s.route?.name || '—'}</Td>
                    <Td>{s.pickupTime || '—'}</Td>
                    <Td>
                      <Badge>{s.todayStatus || s.todayAttendance}</Badge>
                    </Td>
                    <Td className="text-right">
                      <RowActions
                        items={[
                          { label: 'Edit Student', to: `/students/${s._id}/edit` },
                          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(s) },
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
                  (meta.page - 1) * meta.limit + students.length
                } of ${meta.total} students`}
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
        title="Remove this student?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete(deleteTarget)}>
              Delete Student
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">You'll have {UNDO_SECONDS} seconds to undo. After that it's permanent.</p>
      </Modal>
      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} entity="students" label="Students" singular="student" />
    </div>
  );
}

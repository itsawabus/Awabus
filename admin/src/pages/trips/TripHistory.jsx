import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History, SearchX, ListChecks, CheckCircle2, Navigation, AlertTriangle } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import useDebounce from '../../hooks/useDebounce.js';
import { getTrips } from '../../api/trips.js';
import { getDriverOptions } from '../../api/drivers.js';
import { getBusOptions } from '../../api/buses.js';
import Card from '../../components/ui/Card.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';

export default function TripHistory() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [driver, setDriver] = useState('All');
  const [bus, setBus] = useState('All');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search);

  usePageHeader({
    breadcrumb: ['AwaBus', 'Trip History'],
    searchPlaceholder: 'Search by plate number or bus...',
  });

  const { data: driverOptions = [] } = useQuery({ queryKey: ['driver-options'], queryFn: () => getDriverOptions() });
  const { data: busOptions = [] } = useQuery({ queryKey: ['bus-options'], queryFn: getBusOptions });

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, debouncedSearch, status, driver, bus, date],
    queryFn: () => getTrips({ page, q: debouncedSearch, status, driver, bus, date }),
  });

  const trips = data?.data || [];
  const meta = data?.meta;
  const stats = data?.stats || {};
  const hasFilters = debouncedSearch || status !== 'All' || driver !== 'All' || bus !== 'All' || date;

  const clearFilters = () => {
    setSearch('');
    setStatus('All');
    setDriver('All');
    setBus('All');
    setDate('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Trip History" subtitle="Review every completed and in-progress trip, the date it ran and how long it took." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total trips" value={stats.totalTrips ?? 0} hint="Last 30 days" icon={ListChecks} />
        <StatCard
          label="Completed"
          value={stats.completed ?? 0}
          hint={stats.totalTrips ? `${Math.round((stats.completed / stats.totalTrips) * 100)}% success rate` : ''}
          icon={CheckCircle2}
        />
        <StatCard label="Active now" value={stats.active ?? 0} hint="Running smoothly" icon={Navigation} tone="slate" />
        <StatCard label="Delayed trips" value={stats.delayed ?? 0} hint="Action required" icon={AlertTriangle} tone="amber" />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search Trip ID..."
            className="h-10 w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-navy"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-navy"
          />
          <Select className="!h-10 w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {['All', 'Completed', 'In Progress', 'Delayed', 'Cancelled'].map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'Status: All' : s}
              </option>
            ))}
          </Select>
          <Select className="!h-10 w-40" value={driver} onChange={(e) => { setDriver(e.target.value); setPage(1); }}>
            <option value="All">Driver: All</option>
            {driverOptions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </Select>
          <Select className="!h-10 w-40" value={bus} onChange={(e) => { setBus(e.target.value); setPage(1); }}>
            <option value="All">Bus: All</option>
            {busOptions.map((b) => (
              <option key={b._id} value={b._id}>
                {b.plateNumber}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <PageLoader />
        ) : trips.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No trips match these filters"
              description="We couldn't find any trips matching the currently applied parameters. Try clearing your filters or searching another keyword."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="No trips recorded yet"
              description="When drivers start running scheduled routes, live tracking data and completed trip logs will populate here."
            />
          )
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Trip ID</Th>
                <Th>Date</Th>
                <Th>Route Name</Th>
                <Th>Driver</Th>
                <Th>Bus</Th>
                <Th>Departure</Th>
                <Th>Arrival</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
              </Thead>
              <Tbody>
                {trips.map((t) => (
                  <Tr key={t._id} className="cursor-pointer" onClick={() => navigate(`/trip-history/${t._id}`)}>
                    <Td className="font-bold text-slate-900 dark:text-white">{t.tripCode}</Td>
                    <Td>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</Td>
                    <Td>{t.route?.name}</Td>
                    <Td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '—'}</Td>
                    <Td>{t.bus?.plateNumber}</Td>
                    <Td>{t.departureTime || '—'}</Td>
                    <Td>{t.arrivalTime || '--'}</Td>
                    <Td>{t.durationMinutes ? `${Math.floor(t.durationMinutes / 60)}h ${t.durationMinutes % 60}m` : '--'}</Td>
                    <Td>
                      <Badge>{t.status === 'In Progress' ? 'In progress' : t.status}</Badge>
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
                  (meta.page - 1) * meta.limit + trips.length
                } of ${meta.total} trips`}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

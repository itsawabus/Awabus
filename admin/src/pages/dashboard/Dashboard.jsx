import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bus, Settings2, GraduationCap, Navigation, Inbox } from 'lucide-react';
import { getDashboard } from '../../api/dashboard.js';
import { useAuthStore } from '../../store/authStore.js';
import usePageHeader from '../../hooks/usePageHeader.js';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const admin = useAuthStore((s) => s.admin);
  const [search, setSearch] = useState('');
  usePageHeader({
    breadcrumb: ['AwaBus', 'Dashboard'],
    searchPlaceholder: 'Search routes, buses, students...',
    searchValue: search,
    onSearchChange: setSearch,
  });

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 20000 });

  if (isLoading) return <PageLoader label="Loading dashboard..." />;

  const stats = data?.stats || {};
  const bus = data?.busStatusSummary || { active: 0, maintenance: 0, idle: 0 };
  const maxBar = Math.max(bus.active, bus.maintenance, bus.idle, 1);
  const isIdleHours = stats.busesInService === 0 && stats.activeTrips === 0;
  const firstName = admin?.name?.split(' ')[0] || 'Admin';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isIdleHours
            ? 'All bus operations are presently idle. There are no active journeys right now.'
            : "Here is what's happening with the bus routes and students today."}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Buses in Service"
          value={stats.busesInService ?? 0}
          hint={isIdleHours ? 'All active loops finished' : 'Active on active routes'}
          icon={Bus}
        />
        <StatCard
          label="Total Buses"
          value={stats.totalBuses ?? 0}
          hint={`${stats.maintenanceBuses ?? 0} currently in maintenance`}
          icon={Settings2}
          tone="slate"
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents ?? 0}
          hint={`Across ${stats.activeRouteCount ?? 0} operational lines`}
          icon={GraduationCap}
          tone="amber"
        />
        <StatCard
          label="Active Trips"
          value={stats.activeTrips ?? 0}
          hint={`${stats.completedToday ?? 0} trips completed since 7 AM`}
          icon={Navigation}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Bus Status Summary" />
          <div className="flex h-64 items-end justify-around gap-6 px-8 pb-8 pt-6">
            {[
              { label: `Active (${bus.active})`, value: bus.active, color: 'bg-brand-500' },
              { label: `Maint. (${bus.maintenance})`, value: bus.maintenance, color: 'bg-amber-500' },
              { label: `Idle (${bus.idle})`, value: bus.idle, color: 'bg-slate-300 dark:bg-slate-600' },
            ].map((b) => (
              <div key={b.label} className="flex flex-col items-center gap-3">
                <div className="flex h-44 w-14 items-end rounded-lg bg-slate-50 dark:bg-navy">
                  <div
                    className={`w-full rounded-lg ${b.color}`}
                    style={{ height: `${Math.max((b.value / maxBar) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Trip Logs"
            action={
              <Link to="/trip-history" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
                View All
              </Link>
            }
          />
          {data?.recentTrips?.length ? (
            <Table>
              <Thead>
                <Th>Route Name</Th>
                <Th>Bus ID</Th>
                <Th>Status</Th>
                <Th>Scheduled Time</Th>
              </Thead>
              <Tbody>
                {data.recentTrips.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{t.routeName}</Td>
                    <Td>{t.busId}</Td>
                    <Td>
                      <Badge>{t.status === 'In Progress' ? 'In Transit' : t.status}</Badge>
                    </Td>
                    <Td>{t.scheduledTime || '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No Recent Trips"
              description="No operational logs have been entered for active transit routes today. Trips will register automatically once active dispatch resumes."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

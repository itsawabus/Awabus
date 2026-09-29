import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { getBus } from '../../api/buses.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { formatDate } from '../../lib/utils.js';
import { formatPhone } from '../../lib/phone.js';

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '—'}</span>
  </div>
);

export default function BusProfile() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['bus', id], queryFn: () => getBus(id) });

  usePageHeader({ breadcrumb: ['AwaBus', 'Buses', data?.data?.plateNumber || '...'] });

  if (isLoading || !data) return <PageLoader />;
  const bus = data.data;
  const trips = data.recentTrips || [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{bus.plateNumber}</h1>
          <Badge>{bus.status}</Badge>
        </div>
        <div className="flex gap-3">
          <Button as={Link} to="/buses" variant="outline">
            Back to Fleet
          </Button>
          <Button as={Link} to={`/buses/${id}/edit`}>
            <Pencil className="h-4 w-4" /> Edit Bus Details
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Vehicle Specifications" />
            <div className="px-5">
              <InfoRow label="Bus Plate Number" value={bus.plateNumber} />
              <InfoRow label="Name/Nickname" value={bus.name} />
              <InfoRow label="Total Capacity" value={`${bus.capacity} Passengers`} />
              <InfoRow label="Current Route" value={bus.assignedRoute?.name} />
              <InfoRow label="Status" value={<Badge>{bus.status}</Badge>} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Assigned Operator" />
            {bus.assignedDriver ? (
              <div className="flex items-center gap-3 p-5">
                <Avatar name={`${bus.assignedDriver.firstName} ${bus.assignedDriver.lastName}`} size="lg" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {bus.assignedDriver.firstName} {bus.assignedDriver.lastName}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Active School Bus Driver</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{formatPhone(bus.assignedDriver.phone)}</p>
                </div>
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-400">No driver assigned</p>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent Trips" />
          {trips.length ? (
            <Table>
              <Thead>
                <Th>Date</Th>
                <Th>Route</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Status</Th>
              </Thead>
              <Tbody>
                {trips.map((t) => (
                  <Tr key={t._id}>
                    <Td>{formatDate(t.date)}</Td>
                    <Td>{t.route?.name}</Td>
                    <Td>{t.departureTime || '—'}</Td>
                    <Td>{t.arrivalTime || '—'}</Td>
                    <Td>
                      <Badge>{t.status}</Badge>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-slate-400">No trips recorded for this bus yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

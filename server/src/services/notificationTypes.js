// Every kind of notification the admin site can show. Each admin chooses which
// ones they receive in Account settings; every type can be switched off.
export const NOTIFICATION_TYPES = {
  student_not_on_board: {
    category: 'critical',
    severity: 'critical',
    label: 'Student not on board',
    description: 'A driver marked a student as not on board.',
  },
  trip_delayed: {
    category: 'critical',
    severity: 'critical',
    label: 'Trip running late',
    description: 'A driver reported that their trip is running late.',
  },
  trip_started: {
    category: 'trips',
    severity: 'info',
    label: 'Trip started',
    description: 'A driver started a trip.',
  },
  trip_completed: {
    category: 'trips',
    severity: 'info',
    label: 'Trip completed',
    description: 'A trip ended, with a summary of the students carried.',
  },
  student_absent: {
    category: 'trips',
    severity: 'info',
    label: 'Student absent',
    description: 'A student was marked absent at roll call.',
  },
  bus_status: {
    category: 'fleet',
    severity: 'warning',
    label: 'Bus maintenance',
    description: 'A bus was put into maintenance or back into service.',
  },
  bulk_upload: {
    category: 'account',
    severity: 'info',
    label: 'Bulk upload results',
    description: 'An Excel bulk upload finished.',
  },
};

export const NOTIFICATION_CATEGORIES = [
  { key: 'critical', label: 'Critical alerts' },
  { key: 'trips', label: 'Trips' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'account', label: 'Account & uploads' },
];

// Only real notification types can be muted.
export const cleanMutedTypes = (list) =>
  [...new Set((Array.isArray(list) ? list : []).map(String))].filter((t) => NOTIFICATION_TYPES[t]);

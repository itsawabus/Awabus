import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Bus as BusIcon,
  CheckSquare,
  ChevronDown,
  FileSpreadsheet,
  GraduationCap,
  History,
  LayoutGrid,
  Lightbulb,
  Milestone,
  Navigation,
  Search,
  ShieldCheck,
  Smartphone,
  UserCircle,
  Users,
} from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { cn } from '../../lib/utils.js';

// The guide's content. Each section: what the page is for, how to do the main
// jobs (numbered steps), and tips. `to` is the page it describes.
export const GUIDE = [
  {
    id: 'getting-started',
    title: 'Getting started: the setup order',
    icon: Lightbulb,
    summary:
      'Everything in AwaBus is linked: a bus serves a route, a driver drives a bus, and a student rides a route. So set things up in this order.',
    tasks: [
      {
        title: 'Set up your school for the first time',
        steps: [
          'Routes: add each route your buses run (e.g. "West Legon - Ashongman").',
          'Buses: register each bus and pick the route it serves. A route can have only one bus.',
          'Drivers: add each driver and pick their bus. A bus (and its route) can have only one driver.',
          'Students: add each student, their parent or guardian, and their route. Their bus follows from the route.',
        ],
      },
    ],
    tips: [
      'Have a lot to add? Use Bulk upload on each list page to add many at once from an Excel file (same order: Routes, Buses, Drivers, Students).',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutGrid,
    to: '/',
    summary: 'A snapshot of your school transport today: buses, drivers, students and trips.',
    tasks: [
      {
        title: 'Check how today is going',
        steps: ['Open Dashboard from the sidebar.', 'Read the totals at the top and the bus status summary.', 'Recent Trip Logs lists the latest trips; View all opens Trip History.'],
      },
    ],
    tips: ['Refresh the page if something looks out of date.'],
  },
  {
    id: 'routes',
    title: 'Routes',
    icon: Milestone,
    to: '/routes',
    summary: 'The lines your buses run. Each route has an ID (RT-001, RT-002, ...) that AwaBus creates for you.',
    tasks: [
      {
        title: 'Add a route',
        steps: [
          'Click Add Route.',
          'Type the route name, e.g. "Madina - Adenta".',
          'Set the run times: when the morning pick-up usually leaves (before 12:00) and when the afternoon drop-off leaves school (12:00 or later). They are estimates for planning.',
          'Add the stops in the order the bus drives them, then click Create Route.',
        ],
      },
      {
        title: 'Morning pick-up and afternoon drop-off',
        steps: [
          'The time of day decides the run: any trip before 12:00 noon is the morning pick-up (home to school); from noon it is the afternoon drop-off (school to home).',
          'Buttons, statuses and messages follow the run. Morning: Picked up, then At school. Afternoon: On the bus, then Dropped home.',
          'Arrival calls follow it too: in the morning only children still waiting at home are called about ("the bus is almost here"); in the afternoon only children on the bus ("almost home").',
          'Each trip only lists the students who ride that run.',
          'To set them on many routes at once, select the routes and use Edit selected.',
        ],
      },
      { title: 'Edit a route', steps: ['Click the route in the list (or ⋮ then Edit route).', 'Change the name and save.'] },
      {
        title: 'Delete a route',
        steps: ['Click ⋮ on the route, then Delete route, and confirm.', 'A route that still has a bus can\'t be deleted. Move or delete that bus first.'],
      },
    ],
  },
  {
    id: 'buses',
    title: 'Buses',
    icon: BusIcon,
    to: '/buses',
    summary: 'Your fleet. Each bus serves exactly one route and has at most one driver.',
    tasks: [
      {
        title: 'Register a bus',
        steps: [
          'Click Register Bus.',
          'Enter the plate number in the format GR-1234-20 (it is tidied up as you type), a name, and the number of seats (4 to 100).',
          'Pick the route it serves. Routes that already have a bus are greyed out.',
          'Click Register Bus.',
        ],
      },
      { title: 'See a bus', steps: ['Click the bus in the list to see its driver, route and recent trips.'] },
    ],
    tips: ['Deleting a bus also removes it from its route and its driver, so they become free for another bus.'],
  },
  {
    id: 'drivers',
    title: 'Drivers',
    icon: Users,
    to: '/drivers',
    summary: 'The people driving your buses. Drivers use the AwaBus driver app on their phone.',
    tasks: [
      {
        title: 'Add a driver (5 steps)',
        steps: [
          'Personal information: name, phone number (10 digits starting with 0) and optional details. Drivers must be at least 18.',
          'License information: license number as printed on the card, expiry date and class.',
          'Confirm license: AwaBus saves the details and checks they are not expired or already used. It does not contact the DVLA, so compare them with the driver\'s physical license card.',
          'Bus assignment: pick the bus they will drive. Buses that already have a driver, or have no route yet, are greyed out.',
          'Review and click Create Driver.',
        ],
      },
      {
        title: 'Move a driver to another bus',
        steps: ['Open the driver, click Edit Details, pick the new bus and save. Their route changes with the bus.'],
      },
      {
        title: 'Give a driver their setup code',
        steps: [
          'After Create Driver, a setup code (e.g. ABCD-EFGH) is shown once. Give it to the driver in person or by phone.',
          'The first time they open the driver app, they enter their phone number, this code and a new password.',
          'Lost or expired (codes last 7 days)? Open the driver and click Create setup code under Driver App. The old code stops working.',
          'Drivers added by bulk upload have no code yet: make one from their profile the same way.',
        ],
      },
    ],
    tips: [
      'The Drivers list says "App not set up" under anyone who has not chosen a password yet.',
      'Without the setup code nobody can claim a driver account, even if they know the phone number.',
      'The Driver App column shows Online while the driver has the app open and signed in. Offline means they signed out, closed the app, or their phone has been off or without data for 2 minutes; "Last seen" says when the app last reached the school.',
      'Status (Active, Idle...) is set by you; Online / Offline comes from the driver\'s phone.',
      'Buses also show Online / Offline: a bus is online while the driver\'s phone has location on and is reading the bus position. Driver online + bus offline means the driver\'s location is off; driver offline means their mobile data is off, the app is closed or they signed out. You see this on the Buses page, the bus profile and Live Tracking, and the driver sees it in the app.',
    ],
  },
  {
    id: 'students',
    title: 'Students',
    icon: GraduationCap,
    to: '/students',
    summary: 'The children who ride your buses, their parents or guardians, and where they live.',
    tasks: [
      {
        title: 'Add a student (5 steps)',
        steps: [
          'Student information: name, date of birth, class.',
          'Parents & guardian: pick an existing parent (for brothers and sisters) or enter a new one. Delay messages from the driver are sent to this phone.',
          'Transport: pick the route (the bus and driver follow from it), and choose when the student rides: morning & evening, morning only or evening only. They are left off the trips of a run they don\'t ride.',
          'Home location: type the GhanaPost GPS address or pin the home on the map. The green circle is the geofence around the home. Siblings can share one home location.',
          'Review and finish.',
        ],
      },
      {
        title: 'Bus assistant (teacher on bus duty)',
        steps: [
          'The driver opens Bus assistant in the driver app menu and taps Show QR code.',
          'The teacher scans it with their own phone camera. A page opens (no app or account needed): they type their name once.',
          'From there they can do the roll call, mark children as boarded, not here or dropped off, call or text a parent, and send a delay notice. The same limits as the driver apply.',
          'The page stops working when the trip ends, when the driver taps Stop sharing or New code, or after 12 hours.',
          'What the teacher does is recorded as "Bus assistant (their name)" in notifications and on the trip.',
          'During a trip the driver and the teacher see the students nearest first: the child whose home is closest to the bus is at the top (next pick-up in the morning, next drop-off in the afternoon), and the list updates as the bus moves. Children with no home location saved are listed after them.',
          'Both can search for a student by name, class or parent, and open the Attendance list (A–Z), a fixed list that never re-sorts.',
          'Select several students at once (driver: hold a student; teacher: tap Select) to mark them all picked up / dropped / not here, or send one SMS to their parents.',
          'Directions: the next child\'s card has a Directions button that opens Google Maps turn-by-turn navigation to their home.',
          'The teacher can switch on "Share my location as backup". The driver\'s phone always comes first; if it stops reporting for about 45 seconds (for example its data drops), the teacher\'s phone shows the bus position until the driver\'s is back, and Live Tracking says so. The teacher\'s phone is only used while it is near the driver\'s, and only while the page stays open with the screen on.',
          'When arrival calls are switched on (Arkesel voice), each student card shows how the call to the parent went: calling, ringing, answered, call cut, declined, not picked up or didn\'t go through. If the parent doesn\'t pick up, a text is sent instead.',
        ],
      },
      {
        title: 'Cancel a ride (parents by phone, or the office)',
        steps: [
          'Parents call the AwaBus line and press: 1 to cancel the morning pick-up, 2 to cancel the afternoon drop-off, 3 to cancel both, or 4 to be put through to the driver. Calls from numbers that are not a parent on AwaBus are ended.',
          'There is no cut-off time. A cancellation is for the next run of that kind that has not started: today\'s if the bus has not set off yet, otherwise the next school day (Monday to Friday).',
          'A parent\'s cancellation covers all their children who ride that run.',
          'The office can do the same on the student\'s profile: Cancel a ride, then pick the morning pick-up, the afternoon drop-off or both. Upcoming cancellations are listed there and can be undone until that run starts.',
          'On the trip, a cancelled student shows as "Cancelled by parent" for the driver and gets no arrival call.',
        ],
      },
      {
        title: 'Switch arrival calls on or off',
        steps: [
          'Arrival calls ring the parent when the bus is almost at the home: before pickup in the morning, before drop-off in the evening.',
          'They are on for new students. Untick "Call the parent when the bus is almost at the home" (Add Student, Home location step, or Edit Student) for parents who don\'t want calls.',
          'Brothers and sisters: leave it on for one child and off for the others. When you share a home with a sibling who already has calls on, the new student starts with calls off.',
          'Even with calls on for several children, a parent (or a shared home) is called only once per trip. The trip page shows why a child was not called.',
          'To change many students at once, select them and use Edit selected.',
        ],
      },
      {
        title: 'Read the "Today" column',
        steps: [
          'No trip today: no trip on the student\'s route today yet.',
          'Trip not started: the driver hasn\'t started today\'s trip yet.',
          'Absent: the driver marked the student absent in the roll call.',
          'Awaiting pickup: the trip is running and the student hasn\'t been scanned on yet.',
          'On board / Dropped off / Not on board: from the driver\'s scans during the trip.',
          'Not scanned: the trip ended without the student being scanned.',
        ],
      },
    ],
    tips: ['Forms remember what you typed if you leave the page. Use Discard draft to start again.'],
  },
  {
    id: 'live-tracking',
    title: 'Live Tracking',
    icon: Navigation,
    to: '/live-tracking',
    summary: 'Buses on a trip right now, on the map.',
    tasks: [
      {
        title: 'Follow a bus',
        steps: [
          'Open Live Tracking. Each moving bus appears on the map.',
          'Click a bus or a trip in the list to see where it is and which students are on board.',
          'Use the map switcher (top right of the map) for Street, Satellite, Hybrid or Terrain views.',
          '"Following bus" keeps the selected bus in the middle of the map as it moves. Drag the map to look around (following stops); click the button or a bus to follow again.',
          'Optional: set the school\'s GPS address in School settings (account menu, top right). Then, on the morning pick-up, when the bus arrives at school every child marked picked up is marked "At school" by itself (shown as "automatic"), and the school shows on the map with its arrival zone.',
          'The selected bus leaves a trail of dots where it has passed. Bigger dots mark where each child was picked up (blue) or dropped (green): tap or hover one to see the name and the time.',
        ],
      },
    ],
    tips: [
      'A bus only shows once its driver has started the trip in the driver app and the phone has GPS.',
      'On a trip\'s page, the Parent alert column says whether the parent was texted when their child boarded or got off, and when the bus came near their home. Until parent alerts are switched on for your school it says "Not sent (alerts are off)".',
    ],
  },
  {
    id: 'trip-history',
    title: 'Trip History',
    icon: History,
    to: '/trip-history',
    summary: 'Every past trip: when it ran, who drove, and what happened to each student.',
    tasks: [{ title: 'Look up a trip', steps: ['Open Trip History.', 'Click a trip to see its timeline, stops and each student\'s status.'] }],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    to: '/notifications',
    summary: 'The bell at the top of every page tells you what happened on trips, with buses and with uploads.',
    tasks: [
      {
        title: 'Check your notifications',
        steps: [
          'The number on the bell is how many you haven\'t read yet. It turns red when one of them is critical, such as a student not on board.',
          'Click the bell to see the latest ones. Click a notification to open the trip, bus or list it is about; it is then marked as read.',
          'To delete one, point at it and click the bin. On the Notifications page, use Select to tick several and Delete them, or Delete all. Deleting only removes them for you; other admins still see theirs. Notifications are deleted automatically after 30 days.',
          'Click "View all notifications" to see everything from the last 30 days, filtered by Unread, Critical, Trips, Fleet or Uploads.',
        ],
      },
      {
        title: 'Choose what you are notified about',
        steps: [
          'Click the gear in the bell panel, or open Account settings and scroll to Notifications.',
          'Switch off the kinds you don\'t need. Every kind can be switched off, including critical alerts such as a student not on board, so think before turning those off.',
        ],
      },
    ],
    tips: ['Your choices only affect what you see. Other admins at your school keep their own settings.'],
  },
  {
    id: 'bulk-upload',
    title: 'Bulk upload from Excel',
    icon: FileSpreadsheet,
    summary: 'Add many routes, buses, drivers or students at once.',
    tasks: [
      {
        title: 'Upload a file',
        steps: [
          'On the Routes, Buses, Drivers or Students page, click Bulk upload.',
          'Download the template. Its first sheet explains every column with an example.',
          'Fill in one row per item. Columns marked * are mandatory; empty mandatory cells turn red. Use the dropdowns where there are any.',
          'Save the file (as .xlsx) and upload it. AwaBus checks every row and lists any problem by row and column.',
          'When every row is correct, click Import. Nothing is added until the whole file is correct.',
        ],
      },
    ],
    tips: ['Download a fresh template after importing routes or buses, so the dropdowns include the new ones.'],
  },
  {
    id: 'selecting',
    title: 'Selecting and deleting several items',
    icon: CheckSquare,
    summary: 'Change or delete many routes, buses, drivers or students in one go.',
    tasks: [
      {
        title: 'Select items',
        steps: [
          'Click Select (above the list, next to Bulk upload), or press and hold any row for about half a second.',
          'Tap rows to tick them, or use "Select all on this page". The count shows at the bottom.',
          'Click Delete, check the list and confirm. A notice with an Undo button appears for 10 seconds; after that the delete is final. Anything that can\'t be deleted comes back with the reason.',
          'Click Done (or press Esc) to stop selecting.',
        ],
      },
      {
        title: 'Change the same details on many items',
        steps: [
          'Select the items, then click Edit in the bar at the bottom.',
          'Tick each field you want to change (for example Status, Route or Class) and pick the new value. Each field shows what the selected items have now.',
          'Click Apply. Fields you didn\'t tick stay as they were. For 10 seconds you can press Undo to put the old values back.',
          'Things that must be different for every item, like a driver\'s bus or a bus\'s route, can only be changed one at a time.',
        ],
      },
    ],
    tips: ['Clicking the ⋮ button on a row opens that item\'s own menu; clicking the row itself opens the item.'],
  },
  {
    id: 'rules',
    title: 'Rules AwaBus keeps for you',
    icon: ShieldCheck,
    summary: 'AwaBus stops mistakes that would confuse parents or drivers.',
    tasks: [
      {
        title: 'What is checked',
        steps: [
          'One bus per route, and one driver per bus (and so per route).',
          'Phone numbers: 10 digits starting with 0, e.g. 024 412 3456.',
          'Plate numbers like GR-1234-20; license numbers in capital letters and numbers; GPS addresses like GA-543-0125.',
          'Locations must be inside Ghana; geofence radius 20 to 1000 metres; bus seats 4 to 100.',
          'Anything that deletes, suspends, signs out or sends a message asks you to confirm first.',
          'After a delete you have 10 seconds to press Undo. Nothing is removed until that time is up.',
        ],
      },
    ],
  },
  {
    id: 'driver-app',
    title: 'The driver app',
    icon: Smartphone,
    summary: 'What your drivers do on their phone.',
    tasks: [
      {
        title: 'A driver\'s day',
        steps: [
          'Sign in with their phone number and password. The first time, they enter the setup code you gave them and choose a password.',
          'See today\'s trip, take the roll call (Present / Absent), then Start trip.',
          'Scan or tap students as they board and get off.',
          'If running late, send a delay text message to the parents of the students on the trip (up to 3 per trip, at least 10 minutes apart).',
          'End the trip at the end of the route.',
        ],
      },
    ],
    tips: ['Forgot password? On the sign-in screen the driver taps "Forgot password" and gets a code by text message.'],
  },
  {
    id: 'account',
    title: 'Your account',
    icon: UserCircle,
    to: '/account/profile',
    summary: 'Your name, photo, email, phone and password.',
    tasks: [
      {
        title: 'Change your details',
        steps: [
          'Click your name at the top right, then My profile or Account settings.',
          'Changing your email or phone sends a code to the new address or number to confirm it.',
          'To reset your password, enter the new one twice and the code sent to your email or phone.',
        ],
      },
    ],
    tips: ['Forgot your password? On the sign-in page click "Forgot password" and we email you a code.'],
  },
];

// Which guide section matches a page path (used by the "?" button in the top bar).
export function guideSectionFor(pathname) {
  if (pathname === '/' || pathname === '') return 'dashboard';
  const hit = GUIDE.find((g) => g.to && g.to !== '/' && pathname.startsWith(g.to.replace(/\/profile$/, '')));
  return hit?.id || 'getting-started';
}

export default function HelpGuide() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Help & Guide'] });
  const { hash } = useLocation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(() => new Set([hash.slice(1) || 'getting-started']));

  // Opening /help#students scrolls to (and opens) that section.
  useEffect(() => {
    const id = hash.slice(1);
    if (!id) return;
    setOpen((prev) => new Set(prev).add(id));
    const t = setTimeout(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    return () => clearTimeout(t);
  }, [hash]);

  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      q
        ? GUIDE.filter((g) =>
            [g.title, g.summary, ...(g.tips || []), ...g.tasks.flatMap((t) => [t.title, ...t.steps])].join(' ').toLowerCase().includes(q)
          )
        : GUIDE,
    [q]
  );

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <PageHeader title="Help & Guide" subtitle="How each part of AwaBus works, step by step." />

      <Card className="mb-6 overflow-hidden">
        <div className="bg-navy p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">New here? Start with this</p>
          <h2 className="mt-1 text-xl font-extrabold">Set up in four steps</h2>
          <p className="mt-1 text-sm text-slate-300">Each step depends on the one before, so follow them in order.</p>
          <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { n: 1, label: 'Add routes', to: '/routes/new', icon: Milestone },
              { n: 2, label: 'Register buses', to: '/buses/new', icon: BusIcon },
              { n: 3, label: 'Add drivers', to: '/drivers/new', icon: Users },
              { n: 4, label: 'Add students', to: '/students/new', icon: GraduationCap },
            ].map(({ n, label, to, icon: Icon }) => (
              <li key={n}>
                <Link
                  to={to}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 transition-colors hover:bg-white/15"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold">{n}</span>
                  <Icon className="h-4 w-4 text-brand-200" />
                  <span className="font-semibold">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-navy-light dark:text-slate-100"
            />
          </div>
          <nav className="hidden space-y-0.5 lg:block">
            {GUIDE.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-light"
              >
                <g.icon className="h-4 w-4 text-slate-400" />
                {g.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-3">
          {sections.length === 0 && (
            <Card className="p-6 text-sm text-slate-500 dark:text-slate-400">Nothing in the guide matches &quot;{query}&quot;.</Card>
          )}
          {sections.map((g) => {
            const isOpen = Boolean(q) || open.has(g.id);
            return (
              <Card key={g.id} id={`guide-${g.id}`} className="scroll-mt-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 p-5 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
                    <g.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900 dark:text-white">{g.title}</span>
                    <span className="block text-sm text-slate-500 dark:text-slate-400">{g.summary}</span>
                  </span>
                  <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="space-y-5 border-t border-slate-100 p-5 dark:border-slate-800">
                    {g.tasks.map((t) => (
                      <div key={t.title}>
                        <h4 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</h4>
                        <ol className="space-y-2">
                          {t.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-navy dark:text-slate-300">
                                {i + 1}
                              </span>
                              <span className="pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                    {g.tips?.length > 0 && (
                      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        {g.tips.map((tip) => (
                          <p key={tip} className="flex gap-2">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> {tip}
                          </p>
                        ))}
                      </div>
                    )}
                    {g.to && (
                      <Button as={Link} to={g.to} variant="outline" size="sm">
                        Open {g.title} <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

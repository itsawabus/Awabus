import { useState, useEffect } from 'react';
import { useWizardDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Home, MapPin, Route as RouteIcon, Unlink } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { shrinkPhoto } from '../../lib/image.js';
import PhotoUpload from '../../components/ui/PhotoUpload.jsx';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import { formatPhone, fromStoredPhone, isValidPhone, toLocalPhone } from '../../lib/phone.js';
import { DATE_LIMITS, coordsError, dateError, emailError, formatCoord, formatEmail, formatName, nameError } from '../../lib/formats.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Stepper from '../../components/ui/Stepper.jsx';
import Input, { Label, Textarea, FieldError } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import LocationPickerModal from '../../components/ui/LocationPickerModal.jsx';
import GeofenceMap from '../../components/map/GeofenceMap.jsx';
import GpsAddressInput from '../../components/ui/GpsAddressInput.jsx';
import HouseholdLinkPicker from '../../components/students/HouseholdLinkPicker.jsx';
import { getRouteOptions } from '../../api/routes.js';
import { getGuardians } from '../../api/guardians.js';
import LanguageSelect from '../../components/students/LanguageSelect.jsx';
import { DEFAULT_LANGUAGE, languageLabel } from '../../lib/languages.js';
import { createStudent } from '../../api/students.js';
import { CLASS_GRADE_OPTIONS } from '../../lib/options.js';
import RideSessionPicker from '../../components/students/RideSessionPicker.jsx';
import { formatRunTime, rideSessionLabel } from '../../lib/sessions.js';
import ArrivalCallsToggle, { arrivalCallsLabel } from '../../components/students/ArrivalCallsToggle.jsx';

const STEPS = ['Student Information', 'Parents & Guardian', 'Transport Assignment', 'Home Location', 'Review & Finalize'];


const initial = {
  firstName: '',
  lastName: '',
  dob: '',
  gender: 'Female',
  classGrade: '',
  profilePhotoUrl: '',
  guardianId: null,
  guardianFirst: '',
  guardianLast: '',
  guardianRelation: 'Father',
  guardianPhone: '',
  guardianEmail: '',
  guardianLanguage: DEFAULT_LANGUAGE,
  secondContactName: '',
  secondContactPhone: '',
  emergencyInstructions: '',
  route: null,
  pickupPoint: '',
  dropoffPoint: '',
  rideSession: 'both',
  homeAddress: '',
  geofenceRadius: 200,
  lat: '',
  lng: '',
  linkLocationWith: null, // sibling/neighbour whose home location is shared
  linkedLocationName: '',
  arrivalCalls: true,
  arrivalCallsNote: '',
};

export default function AddStudent() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Students', 'Add student'] });
  const queryClient = useQueryClient();

  // The wizard (form + step) is saved as a draft so leaving the page doesn't lose it.
  const { form, setForm, step, setStep, restored, clear: clearDraft } = useWizardDraft('student:new', initial);

  const [created, setCreated] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [stepError, setStepError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (key) => (val) => {
    setErrors((e) => ({ ...e, [key]: '' }));
    setForm((f) => ({ ...f, [key]: val }));
  };

  // Drafts used to live under this key (not namespaced per admin); drop it.
  useEffect(() => {
    try {
      localStorage.removeItem('addStudentDraft');
    } catch {
      // ignore
    }
  }, []);

  const { data: routeOptions, isLoading: routesLoading } = useQuery({ queryKey: ['route-options'], queryFn: getRouteOptions });
  const { data: guardianOptions = [] } = useQuery({ queryKey: ['guardian-options'], queryFn: () => getGuardians() });

  const mutation = useMutation({
    mutationFn: (payload) => createStudent(payload),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setCreated(student);
      clearDraft();
    },
  });

  if (routesLoading) return <PageLoader />;

  // Students must be assigned to a route (routes are created first), so
  // there's nothing to assign a student to until at least one exists.
  if (!created && (routeOptions || []).length === 0) {
    return (
      <div>
        <PageHeader title="Add Student" />
        <Card>
          <EmptyState
            icon={RouteIcon}
            title="No routes yet"
            description="A student has to be assigned to a route, so create a route first before enrolling a student."
            action={
              <Button as={Link} to="/routes/new">
                Create a route
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const selectedRoute = routeOptions.find((r) => r._id === form.route);
  const selectedBus = selectedRoute?.assignedBus;

  // Checks that must pass before leaving a step (same rules for Continue and for
  // jumping ahead via the stepper).
  const validateStep = (n) => {
    let next = {};
    if (n === 1) {
      next = {
        firstName: nameError(form.firstName, 'First name'),
        lastName: nameError(form.lastName, 'Last name'),
        dob: dateError(form.dob, 'studentDob'),
      };
    }
    if (n === 2 && !form.guardianId) {
      next = {
        guardianFirst: nameError(form.guardianFirst, 'First name', { required: false }),
        guardianLast: nameError(form.guardianLast, 'Last name', { required: false }),
        guardianEmail: emailError(form.guardianEmail),
      };
    }
    if (n === 2) next.secondContactName = nameError(form.secondContactName, 'Name', { required: false });
    if (n === 4 && !form.linkLocationWith) next.coords = coordsError(form.lat, form.lng);
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setStepError('Some fields need fixing. Check the messages in red.');
      return false;
    }
    if (n === 2 && !form.guardianId && !isValidPhone(form.guardianPhone)) {
      setStepError('Enter the guardian\'s phone number: 10 digits starting with 0, e.g. 024 412 3456');
      return false;
    }
    if (n === 2 && form.secondContactPhone && !isValidPhone(form.secondContactPhone)) {
      setStepError('The second contact phone must be 10 digits starting with 0');
      return false;
    }
    if (n === 3 && !form.route) {
      setRouteError('Select the route this student will use');
      return false;
    }
    return true;
  };
  const goTo = (target) => {
    setStepError('');
    for (let n = step; n < target; n += 1) {
      if (!validateStep(n)) {
        setStep(n);
        return;
      }
    }
    setStep(target);
  };
  const goNext = () => goTo(Math.min(step + 1, STEPS.length));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    const profilePhotoUrl = await shrinkPhoto(form.profilePhotoUrl);
    mutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      dob: form.dob,
      gender: form.gender,
      classGrade: form.classGrade,
      profilePhotoUrl,
      guardian: form.guardianId
        ? { id: form.guardianId, preferredLanguage: form.guardianLanguage || DEFAULT_LANGUAGE }
        : {
            preferredLanguage: form.guardianLanguage || DEFAULT_LANGUAGE,
            firstName: form.guardianFirst,
            lastName: form.guardianLast,
            relation: form.guardianRelation,
            phone: toLocalPhone(form.guardianPhone),
            email: form.guardianEmail,
          },
      secondContactName: form.secondContactName,
      secondContactPhone: toLocalPhone(form.secondContactPhone),
      emergencyInstructions: form.emergencyInstructions,
      route: form.route,
      pickupPoint: form.pickupPoint,
      dropoffPoint: form.dropoffPoint,
      rideSession: form.rideSession || 'both',
      homeAddress: form.homeAddress,
      geofenceRadius: Number(form.geofenceRadius),
      lat: form.lat ? Number(form.lat) : undefined,
      lng: form.lng ? Number(form.lng) : undefined,
      linkLocationWith: form.linkLocationWith || undefined,
      arrivalCalls: form.arrivalCalls !== false,
    });
  };

  if (created) {
    return (
      <div>
        <PageHeader title="Add Student" />
        <Card className="mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-brand-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Student added successfully</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The student has been enrolled and assigned to their respective route.
          </p>
          <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm dark:bg-navy">
            <Row label="Student Name" value={`${created.firstName} ${created.lastName}`} />
            <Row label="Student ID" value={created.studentCode} />
            <Row label="Assigned Route" value={created.route?.name || '—'} />
            <Row label="Assigned Bus" value={created.bus ? `${created.bus.name} (${created.bus.plateNumber})` : 'Not assigned yet'} />
            <Row
              label="Primary Contact"
              value={created.primaryGuardian ? `${created.primaryGuardian.firstName} (${formatPhone(created.primaryGuardian.phone)})` : '—'}
            />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button as={Link} to="/students" variant="outline">
              Back to Students
            </Button>
            <Button
              onClick={() => {
                setCreated(null);
                clearDraft();
              }}
            >
              Add Another Student
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Add Student — Step ${step}`} subtitle={STEP_SUBTITLES[step - 1]} />
      <Stepper steps={STEPS} activeStep={step} onStepClick={goTo} />
      <DraftNotice show={restored} onDiscard={clearDraft} discardLabel="Start over" />

      <Card>
        <CardBody>
          {step === 1 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label required>First Name</Label>
                <Input value={form.firstName} onChange={(e) => set('firstName')(formatName(e.target.value))} placeholder="e.g. Abena" error={Boolean(errors.firstName)} required />
                <FieldError>{errors.firstName}</FieldError>
              </div>
              <div>
                <Label required>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => set('lastName')(formatName(e.target.value))} placeholder="e.g. Osei" error={Boolean(errors.lastName)} required />
                <FieldError>{errors.lastName}</FieldError>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={form.dob} min={DATE_LIMITS.studentDob.min} max={DATE_LIMITS.studentDob.max} onChange={(e) => set('dob')(e.target.value)} error={Boolean(errors.dob)} />
                <FieldError>{errors.dob}</FieldError>
              </div>
              <div>
                <Label>Gender</Label>
                <div className="flex h-11 items-center gap-6">
                  {['Female', 'Male'].map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <input type="radio" checked={form.gender === g} onChange={() => set('gender')(g)} className="h-4 w-4 accent-brand-600" />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Class / Grade</Label>
                <select
                  value={form.classGrade}
                  onChange={(e) => set('classGrade')(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="" disabled>
                    Select class / grade
                  </option>
                  {CLASS_GRADE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Student ID</Label>
                <Input disabled value="Autogenerated" />
              </div>
              <div className="sm:col-span-2">
                <Label>Student Photo</Label>
                <PhotoUpload value={form.profilePhotoUrl} onChange={set('profilePhotoUrl')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Parents & Guardian Information</h3>
              </div>

              <div className="mb-5">
                <Label>Link Existing Parent (optional)</Label>
                <SearchableSelect
                  placeholder="Search existing guardians..."
                  value={form.guardianId}
                  onChange={(val) => {
                    set('guardianId')(val);
                    const g = guardianOptions.find((x) => x._id === val);
                    if (g) {
                      set('guardianFirst')(g.firstName);
                      set('guardianLast')(g.lastName);
                      set('guardianPhone')(fromStoredPhone(g.phone));
                      set('guardianEmail')(g.email || '');
                      set('guardianLanguage')(g.preferredLanguage || DEFAULT_LANGUAGE);
                    }
                  }}
                  options={guardianOptions.map((g) => ({ value: g._id, label: `${g.firstName} ${g.lastName}`, description: formatPhone(g.phone) }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label required>Guardian First Name</Label>
                  <Input value={form.guardianFirst} onChange={(e) => set('guardianFirst')(formatName(e.target.value))} placeholder="e.g. Kofi" error={Boolean(errors.guardianFirst)} />
                  <FieldError>{errors.guardianFirst}</FieldError>
                </div>
                <div>
                  <Label required>Guardian Last Name</Label>
                  <Input value={form.guardianLast} onChange={(e) => set('guardianLast')(formatName(e.target.value))} placeholder="e.g. Osei" error={Boolean(errors.guardianLast)} />
                  <FieldError>{errors.guardianLast}</FieldError>
                </div>
                <div>
                  <Label>Relation</Label>
                  <Select value={form.guardianRelation} onChange={(e) => set('guardianRelation')(e.target.value)}>
                    {['Father', 'Mother', 'Guardian', 'Sibling', 'Other'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label required>Guardian Phone</Label>
                  <PhoneInput value={form.guardianPhone} onChange={set('guardianPhone')} />
                </div>
                <LanguageSelect value={form.guardianLanguage} onChange={set('guardianLanguage')} />
                <div>
                  <Label>Guardian Email</Label>
                  <Input type="email" value={form.guardianEmail} onChange={(e) => set('guardianEmail')(formatEmail(e.target.value))} placeholder="kofi.osei@gmail.com" error={Boolean(errors.guardianEmail)} />
                  <FieldError>{errors.guardianEmail}</FieldError>
                </div>
                <div>
                  <Label>Second Contact Name</Label>
                  <Input value={form.secondContactName} onChange={(e) => set('secondContactName')(formatName(e.target.value))} placeholder="e.g. Mary Osei" error={Boolean(errors.secondContactName)} />
                  <FieldError>{errors.secondContactName}</FieldError>
                </div>
                <div>
                  <Label>Second Contact Phone</Label>
                  <PhoneInput value={form.secondContactPhone} onChange={set('secondContactPhone')} placeholder="020 111 2233" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Emergency Instructions</Label>
                  <Textarea
                    value={form.emergencyInstructions}
                    onChange={(e) => set('emergencyInstructions')(e.target.value)}
                    placeholder="e.g. Contact father's office if unreachable"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">Transport Assignment</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label required>Route</Label>
                  <SearchableSelect
                    placeholder="Select route"
                    value={form.route}
                    onChange={(val) => {
                      set('route')(val);
                      setRouteError('');
                    }}
                    error={Boolean(routeError)}
                    options={routeOptions.map((r) => ({ value: r._id, label: `${r.routeId} - ${r.name}` }))}
                  />
                  <FieldError>{routeError}</FieldError>
                </div>
                <div>
                  <Label>Assigned Bus (from selected route)</Label>
                  <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-navy dark:text-slate-300">
                    {selectedBus ? `${selectedBus.name} (${selectedBus.plateNumber})` : selectedRoute ? 'No bus assigned to this route yet' : 'Select a route to see its bus'}
                  </div>
                </div>
                <div>
                  <Label>Pick-up Point</Label>
                  <Input value={form.pickupPoint} onChange={(e) => set('pickupPoint')(e.target.value)} placeholder="e.g. East Legon Starbites Station" />
                </div>
                <div>
                  <Label>Drop-off Point</Label>
                  <Input value={form.dropoffPoint} onChange={(e) => set('dropoffPoint')(e.target.value)} placeholder="e.g. East Legon Starbites Station" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Rides</Label>
                  <RideSessionPicker value={form.rideSession} onChange={set('rideSession')} />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Students who ride one run only are left off the other run's trip.
                  </p>
                </div>
              </div>

              {selectedRoute && (
                <Card className="mt-6 bg-slate-50 dark:bg-navy">
                  <CardHeader title="Route & Operational Summary" />
                  <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <SummaryStat label="Stops On Route" value={`${selectedRoute.stops?.length || 0} Scheduled Stops`} />
                    <SummaryStat label="Bus Driver" value={selectedRoute.assignedDriver ? `${selectedRoute.assignedDriver.firstName} ${selectedRoute.assignedDriver.lastName}` : 'Not assigned yet'} />
                    <SummaryStat label="Seats Available" value={selectedBus ? `${selectedBus.capacity} Seats` : '—'} />
                    <SummaryStat label="Morning pick-up" value={formatRunTime(selectedRoute.morningStartTime)} />
                    <SummaryStat label="Afternoon drop-off" value={formatRunTime(selectedRoute.eveningStartTime)} />
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">Home Location & Geofencing</h3>

              <Card className="mb-6 bg-slate-50 dark:bg-navy">
                <CardBody>
                  <p className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Home className="h-4 w-4 text-brand-600" />
                    Share home location with a sibling or neighbour
                  </p>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                    Linked students share one GPS address, map pin and geofence. Changing the location of any of them
                    later updates all of them.
                  </p>
                  {form.linkLocationWith ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Sharing home location with {form.linkedLocationName}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, linkLocationWith: null, linkedLocationName: '', arrivalCallsNote: '' }))}
                      >
                        <Unlink className="h-4 w-4" />
                        Unlink
                      </Button>
                    </div>
                  ) : (
                    <HouseholdLinkPicker
                      guardianId={form.guardianId}
                      onSelect={(s) =>
                        setForm((f) => ({
                          ...f,
                          linkLocationWith: s._id,
                          linkedLocationName: `${s.firstName} ${s.lastName}`,
                          homeAddress: s.homeAddress || '',
                          lat: s.lat != null ? String(s.lat) : '',
                          lng: s.lng != null ? String(s.lng) : '',
                          geofenceRadius: s.geofenceRadius || f.geofenceRadius,
                          // One call per home is enough: when the sibling already
                          // gets arrival calls, start this one switched off.
                          ...(s.arrivalCalls !== false
                            ? {
                                arrivalCalls: false,
                                arrivalCallsNote: `Switched off because ${s.firstName} already gets arrival calls at this home. Turn it on if this parent wants a call for each child.`,
                              }
                            : { arrivalCallsNote: '' }),
                        }))
                      }
                    />
                  )}
                </CardBody>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="grid grid-cols-1 content-start gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <GpsAddressInput
                      disabled={Boolean(form.linkLocationWith)}
                      value={form.homeAddress}
                      onChange={set('homeAddress')}
                      onResolve={({ lat, lng }) => setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Geofence Radius (meters)</Label>
                    <Select
                      disabled={Boolean(form.linkLocationWith)}
                      value={form.geofenceRadius}
                      onChange={(e) => set('geofenceRadius')(e.target.value)}
                    >
                      {[...new Set([100, 150, 200, 300, 500, Number(form.geofenceRadius)])].filter(Boolean).sort((a, b) => a - b).map((r) => (
                        <option key={r} value={r}>
                          {r}m Notification Zone
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Latitude</Label>
                    <Input disabled={Boolean(form.linkLocationWith)} inputMode="decimal" value={form.lat} onChange={(e) => { setErrors((x) => ({ ...x, coords: '' })); set('lat')(formatCoord(e.target.value)); }} placeholder="5.6322" error={Boolean(errors.coords)} />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input disabled={Boolean(form.linkLocationWith)} inputMode="decimal" value={form.lng} onChange={(e) => { setErrors((x) => ({ ...x, coords: '' })); set('lng')(formatCoord(e.target.value)); }} placeholder="-0.1581" error={Boolean(errors.coords)} />
                  </div>
                  {errors.coords && (
                    <div className="sm:col-span-2">
                      <FieldError>{errors.coords}</FieldError>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Button type="button" variant="outline" onClick={() => setMapOpen(true)} disabled={Boolean(form.linkLocationWith)}>
                      <MapPin className="h-4 w-4" />
                      Pick on map
                    </Button>
                  </div>
                </div>

                <Card className="flex flex-col overflow-hidden">
                  <CardHeader title="Interactive Geofence Picker" />
                  <div className="h-72 px-5 pt-1 sm:h-80">
                    <GeofenceMap
                      readOnly={Boolean(form.linkLocationWith)}
                      lat={form.lat}
                      lng={form.lng}
                      radius={form.geofenceRadius}
                      onMove={(lat, lng) => setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))}
                    />
                  </div>
                  <p className="p-5 text-xs text-slate-400">
                    {form.linkLocationWith
                      ? `Location shared with ${form.linkedLocationName}. Unlink to set a different home location.`
                      : 'Click the map or drag the pin to update the latitude and longitude.'}{' '}
                    The green circle shows the {form.geofenceRadius}m geofence radius.
                  </p>
                </Card>
              </div>
              <LocationPickerModal
                open={mapOpen}
                onClose={() => setMapOpen(false)}
                lat={form.lat}
                lng={form.lng}
                radius={form.geofenceRadius}
                onConfirm={(lat, lng) => setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))}
              />
              <div className="mt-6">
                <Label>Arrival calls</Label>
                <ArrivalCallsToggle
                  value={form.arrivalCalls}
                  onChange={(on) => setForm((f) => ({ ...f, arrivalCalls: on, arrivalCallsNote: '' }))}
                  note={form.arrivalCallsNote}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Review Student Profile</h3>
              <section>
                <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">Personal Information</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <SummaryStat label="Name" value={`${form.firstName} ${form.lastName}`} />
                  <SummaryStat label="Student ID" value="Autogenerated" />
                  <SummaryStat label="Class" value={form.classGrade || '—'} />
                </div>
              </section>
              <section>
                <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">Guardian Information</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <SummaryStat label="Guardian" value={`${form.guardianFirst} ${form.guardianLast} (${form.guardianRelation})`} />
                  <SummaryStat label="Phone" value={form.guardianPhone ? formatPhone(form.guardianPhone) : '—'} />
                  <SummaryStat label="Email" value={form.guardianEmail || '—'} />
                  <SummaryStat label="Language for calls" value={languageLabel(form.guardianLanguage)} />
                </div>
              </section>
              <section>
                <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">Transit Assignments</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <SummaryStat label="Route" value={selectedRoute?.name || '—'} />
                  <SummaryStat label="Rides" value={rideSessionLabel(form.rideSession)} />
                  <SummaryStat label="Bus" value={selectedBus ? `${selectedBus.name} (${selectedBus.plateNumber})` : 'Not assigned yet'} />
                  <SummaryStat label="Pick-up Point" value={form.pickupPoint || '—'} />
                </div>
              </section>
              <section>
                <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">Home Geo-Location</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <SummaryStat label="Address" value={form.homeAddress || '—'} />
                  <SummaryStat label="Geofence" value={`${form.geofenceRadius}m`} />
                  <SummaryStat label="Coordinates" value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : '—'} />
                  <SummaryStat label="Shares home with" value={form.linkedLocationName || '—'} />
                  <SummaryStat label="Arrival calls" value={arrivalCallsLabel(form.arrivalCalls)} />
                </div>
              </section>
            </div>
          )}
        </CardBody>

        {mutation.error && (
          <div className="mx-6 mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {mutation.error.message}
          </div>
        )}

        {stepError && (
          <div className="mx-5 mb-0 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {stepError}
          </div>
        )}
        <div className="flex justify-between border-t border-slate-100 p-5 dark:border-slate-800">
          {step > 1 ? (
            <Button variant="outline" onClick={goBack} type="button">
              Back
            </Button>
          ) : (
            <Button as={Link} to="/students" variant="outline" type="button">
              Cancel
            </Button>
          )}
          {step < STEPS.length ? (
            <Button onClick={goNext}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} loading={mutation.isPending}>
              Create Student
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

const STEP_SUBTITLES = [
  "Enter student's personal information and select their class.",
  'Link parent or primary guardian profiles to this student.',
  'Assign the route this student will use for pick-up and drop-off.',
  'Indicate home coordinates and configure geographic notifications.',
  'Verify all student and family details before saving.',
];

const SummaryStat = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0 dark:border-slate-800">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-semibold text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

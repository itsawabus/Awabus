import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bus as BusIcon, CheckCircle2, IdCard, ShieldAlert } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { shrinkPhoto } from '../../lib/image.js';
import PhotoUpload from '../../components/ui/PhotoUpload.jsx';
import { formatPhone, isValidPhone, toLocalPhone } from '../../lib/phone.js';
import { useWizardDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Stepper from '../../components/ui/Stepper.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Input.jsx';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx';
import Spinner, { PageLoader } from '../../components/ui/Spinner.jsx';
import { getBusOptions } from '../../api/buses.js';
import { createDriver, getDriverOptions, validateLicense } from '../../api/drivers.js';
import SetupCodeBox from '../../components/account/SetupCodeBox.jsx';
import { busAvailable, busHolders, busPickerOptions, busTakenBy } from '../../lib/assignments.js';
import {
  DATE_LIMITS,
  dateError,
  emailError,
  formatEmail,
  formatName,
  licenseError,
  nameError,
} from '../../lib/formats.js';
import { LicenseInput } from '../../components/ui/FormattedInputs.jsx';

const STEPS = [
  'Personal Information',
  'License Information',
  'Confirm License',
  'Bus Assignment',
  'Review',
];

const initialForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  dob: '',
  gender: 'Male',
  profilePhotoUrl: '',
  licenseNumber: '',
  licenseExpiry: '',
  licenseClass: 'Class F (Heavy Duty / Bus)',
  assignedBus: null,
  emergencyContactName: '',
  emergencyContactRelation: 'Wife',
  emergencyContactPhone: '',
};

export default function AddDriver() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Drivers', 'Add driver'] });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The wizard (form + step) is saved as a draft so leaving the page doesn't lose it.
  const { form, setForm, step, setStep, restored, clear: clearDraft } = useWizardDraft('driver:new', initialForm);
  const [validation, setValidation] = useState(null);
  const [created, setCreated] = useState(null);
  const [busError, setBusError] = useState('');
  const [stepError, setStepError] = useState('');
  const [errors, setErrors] = useState({});

  const set = (key) => (val) => {
    setErrors((e) => ({ ...e, [key]: '' }));
    setStepError('');
    // Changing the license after it was saved means it has to be checked again
    // (on the confirm step itself the admin re-checks with the button).
    if ((key === 'licenseNumber' || key === 'licenseExpiry') && step !== 3) setValidation(null);
    setForm((f) => ({ ...f, [key]: val }));
  };

  const { data: busOptions, isLoading: busesLoading } = useQuery({ queryKey: ['bus-options'], queryFn: getBusOptions });
  const { data: driverOptions = [], isLoading: driversLoading } = useQuery({
    queryKey: ['driver-options'],
    queryFn: () => getDriverOptions(),
  });
  const holders = busHolders(busOptions, driverOptions);

  const validateMutation = useMutation({
    mutationFn: () =>
      validateLicense({ licenseNumber: form.licenseNumber, licenseExpiry: form.licenseExpiry }),
    onSuccess: (res) => setValidation(res),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => createDriver(payload),
    onSuccess: (driver) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      // The bus just taken must show as taken the next time the picker opens.
      queryClient.invalidateQueries({ queryKey: ['bus-options'] });
      queryClient.invalidateQueries({ queryKey: ['driver-options'] });
      setCreated(driver);
      clearDraft();
    },
  });

  // License validation runs on reaching step 3, and also when a restored draft
  // or a stepper jump lands beyond it.
  useEffect(() => {
    if (step >= 3 && !validation && !validateMutation.isPending) validateMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, validation]);

  // Checks that must pass before leaving a step (same rules for Continue and for
  // jumping ahead via the stepper).
  const validateStep = (n) => {
    let next = {};
    if (n === 1) {
      next = {
        firstName: nameError(form.firstName, 'First name'),
        lastName: nameError(form.lastName, 'Last name'),
        phone: isValidPhone(form.phone) ? '' : 'Enter a 10-digit number starting with 0, e.g. 024 412 3456',
        email: emailError(form.email),
        dob: dateError(form.dob, 'driverDob'),
      };
    }
    if (n === 2) {
      next = {
        licenseNumber: licenseError(form.licenseNumber),
        licenseExpiry: form.licenseExpiry ? dateError(form.licenseExpiry, 'licenseExpiry') : 'Enter the license expiry date',
      };
    }
    if (n === 3 && !validation?.valid) {
      setStepError('Fix the license details before continuing');
      return false;
    }
    if (n === 4) {
      next = {
        emergencyContactName: nameError(form.emergencyContactName, 'Emergency contact name'),
        emergencyContactPhone: !form.emergencyContactPhone
          ? 'Enter the emergency contact\'s phone number'
          : !isValidPhone(form.emergencyContactPhone)
            ? 'Must be 10 digits starting with 0'
            : '',
      };
      if (!form.assignedBus) {
        setBusError('Select the bus this driver will operate');
        return false;
      }
      const takenBy = busTakenBy(holders, form.assignedBus);
      if (takenBy) {
        setBusError(`This bus already has a driver (${takenBy}). A bus and its route can only have one driver.`);
        return false;
      }
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setStepError('Some fields need fixing. Check the messages in red.');
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

  const handleCreate = async () => {
    if (!validateStep(4)) {
      setStep(4);
      return;
    }
    createMutation.mutate({
      ...form,
      phone: toLocalPhone(form.phone),
      emergencyContactPhone: toLocalPhone(form.emergencyContactPhone),
      profilePhotoUrl: await shrinkPhoto(form.profilePhotoUrl),
      licenseValidation: {
        status: validation?.valid ? 'verified' : 'pending',
        message: validation?.message || '',
        checkedAt: new Date().toISOString(),
      },
    });
  };

  if (busesLoading || driversLoading) return <PageLoader />;

  // Drivers must be assigned to a bus (buses come before drivers), so there's
  // nothing to assign until at least one bus is registered.
  if (!created && (busOptions || []).length === 0) {
    return (
      <div>
        <PageHeader title="Add driver" subtitle="Create a new driver profile and save their license details." />
        <Card>
          <EmptyState
            icon={BusIcon}
            title="No buses yet"
            description="A driver has to be assigned to a bus, so register a bus first before adding a driver."
            action={
              <Button as={Link} to="/buses/new">
                Register a bus
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // Every bus already has its one driver, so there is nothing to assign to.
  if (!created && !busOptions.some((bus) => busAvailable(holders, bus))) {
    return (
      <div>
        <PageHeader title="Add driver" subtitle="Create a new driver profile and save their license details." />
        <Card>
          <EmptyState
            icon={BusIcon}
            title="No bus is free for a new driver"
            description="Each bus and its route can only have one driver, and every bus either has a driver already or has no route yet. Register another bus, give a bus a route, or unassign a driver from their bus first."
            action={
              <Button as={Link} to="/buses/new">
                Register a bus
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const selectedBus = busOptions.find((b) => b._id === form.assignedBus);
  const selectedRoute = selectedBus?.assignedRoute;

  if (created) {
    return (
      <div>
        <PageHeader title="Add driver" subtitle="Create a new driver profile and save their license details." />
        <Card className="mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-brand-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Driver added successfully</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The new driver profile has been created and assignments have been activated.
          </p>
          <p className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            {created.firstName} {created.lastName}
          </p>
          <p className="text-sm font-medium text-brand-600">{created.status}</p>
          <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm dark:bg-navy">
            <Row label="License Number" value={created.licenseNumber} />
            <Row label="Assigned Bus" value={created.assignedBus ? `${created.assignedBus.name}` : '—'} />
            <Row label="Assigned Route" value={created.assignedRoute?.name || '—'} />
            <Row label="Contact Phone" value={formatPhone(created.phone)} />
          </div>
          {created.setupCode && (
            <div className="mt-4">
              <SetupCodeBox code={created.setupCode} expires={created.setupCodeExpires}>
                Give this code to {created.firstName}. They enter it with their phone number the first time they open the AwaBus
                driver app, then choose their own password.
              </SetupCodeBox>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <Button as={Link} to="/drivers" variant="outline">
              Back to Drivers
            </Button>
            <Button
              onClick={() => {
                setCreated(null);
                setValidation(null);
                clearDraft();
              }}
            >
              Add Another Driver
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Add driver" subtitle="Create a new driver profile and save their license details." />
      <Stepper steps={STEPS} activeStep={step} onStepClick={goTo} />
      <DraftNotice
        show={restored}
        onDiscard={() => {
          setValidation(null);
          clearDraft();
        }}
        discardLabel="Start over"
      />

      <Card>
        <CardBody>
          {step === 1 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">Personal Information</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label required>First Name</Label>
                  <Input value={form.firstName} onChange={(e) => set('firstName')(formatName(e.target.value))} placeholder="e.g. Kwame" error={Boolean(errors.firstName)} required />
                  <FieldError>{errors.firstName}</FieldError>
                </div>
                <div>
                  <Label required>Last Name</Label>
                  <Input value={form.lastName} onChange={(e) => set('lastName')(formatName(e.target.value))} placeholder="e.g. Mensah" error={Boolean(errors.lastName)} required />
                  <FieldError>{errors.lastName}</FieldError>
                </div>
                <div>
                  <Label required>Phone Number</Label>
                  <PhoneInput value={form.phone} onChange={set('phone')} error={Boolean(errors.phone)} />
                  <FieldError>{errors.phone}</FieldError>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email')(formatEmail(e.target.value))} placeholder="e.g. kwame.mensah@gmail.com" error={Boolean(errors.email)} />
                  <FieldError>{errors.email}</FieldError>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.dob} min={DATE_LIMITS.driverDob.min} max={DATE_LIMITS.driverDob.max} onChange={(e) => set('dob')(e.target.value)} error={Boolean(errors.dob)} />
                  <FieldError>{errors.dob}</FieldError>
                </div>
                <div>
                  <Label>Gender</Label>
                  <div className="flex h-11 items-center gap-6">
                    {['Male', 'Female'].map((g) => (
                      <label key={g} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <input type="radio" checked={form.gender === g} onChange={() => set('gender')(g)} className="h-4 w-4 accent-brand-600" />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Label>Profile Photo</Label>
                <PhotoUpload value={form.profilePhotoUrl} onChange={set('profilePhotoUrl')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">License Information</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label required>License Number</Label>
                  <LicenseInput value={form.licenseNumber} onChange={set('licenseNumber')} error={errors.licenseNumber} required />
                  <FieldError>{errors.licenseNumber}</FieldError>
                </div>
                <div>
                  <Label required>License Expiry Date</Label>
                  <Input type="date" value={form.licenseExpiry} min={DATE_LIMITS.licenseExpiry.min} max={DATE_LIMITS.licenseExpiry.max} onChange={(e) => set('licenseExpiry')(e.target.value)} error={Boolean(errors.licenseExpiry)} required />
                  <FieldError>{errors.licenseExpiry}</FieldError>
                </div>
                <div>
                  <Label>License Class</Label>
                  <Select value={form.licenseClass} onChange={(e) => set('licenseClass')(e.target.value)}>
                    <option>Class B (Light Vehicle)</option>
                    <option>Class D (Articulator)</option>
                    <option>Class E (Motorbike)</option>
                    <option>Class F (Heavy Duty / Bus)</option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">Confirm License</h3>
              {validateMutation.isPending && (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                  <Spinner size="lg" />
                  <p className="text-sm font-medium">Saving license details...</p>
                </div>
              )}
              {!validateMutation.isPending && validateMutation.error && !validation && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                  {validateMutation.error.message}
                </p>
              )}
              {!validateMutation.isPending && validation?.valid && (
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-900 dark:bg-brand-500/10">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-600" />
                    <p className="text-base font-bold text-brand-700 dark:text-brand-300">License details saved</p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <SummaryStat label="License Number" value={form.licenseNumber} />
                    <SummaryStat label="Expiry Date" value={form.licenseExpiry} />
                    <SummaryStat label="License Class" value={form.licenseClass} />
                  </div>
                  <p className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <IdCard className="mt-0.5 h-4 w-4 shrink-0" />
                    Please make sure these match the driver&apos;s physical license card.
                  </p>
                </div>
              )}
              {!validateMutation.isPending && validation && !validation.valid && (
                <div>
                  <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <p className="font-bold text-red-700 dark:text-red-400">Some license details need fixing</p>
                      <p className="text-sm text-red-700/80 dark:text-red-400/80">Correct them below, then press Check again.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <Label>License Number</Label>
                      <LicenseInput value={form.licenseNumber} onChange={set('licenseNumber')} error={validation.errors?.licenseNumber} />
                      <FieldError>{validation.errors?.licenseNumber}</FieldError>
                    </div>
                    <div>
                      <Label>License Expiry Date</Label>
                      <Input
                        type="date"
                        min={DATE_LIMITS.licenseExpiry.min}
                        max={DATE_LIMITS.licenseExpiry.max}
                        value={form.licenseExpiry}
                        onChange={(e) => set('licenseExpiry')(e.target.value)}
                        error={Boolean(validation.errors?.licenseExpiry)}
                      />
                      <FieldError>{validation.errors?.licenseExpiry}</FieldError>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="mb-5 text-base font-bold text-slate-900 dark:text-white">Bus Assignment</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label required>Assigned Bus</Label>
                  <SearchableSelect
                    placeholder="Select the primary vehicle"
                    value={form.assignedBus}
                    onChange={(val) => {
                      set('assignedBus')(val);
                      setBusError('');
                    }}
                    error={Boolean(busError)}
                    options={busPickerOptions(busOptions, holders)}
                  />
                  <FieldError>{busError}</FieldError>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Each bus has one driver. Buses that already have a driver can&apos;t be picked.
                  </p>
                </div>
                <div>
                  <Label>Route (from selected bus)</Label>
                  <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-navy dark:text-slate-300">
                    {selectedRoute ? `${selectedRoute.routeId} - ${selectedRoute.name}` : 'Select a bus to see its route'}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">A bus is always tied to one route, so this follows automatically.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <Label required>Emergency Contact Name</Label>
                  <Input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName')(formatName(e.target.value))} placeholder="e.g. Abena Mensah" error={Boolean(errors.emergencyContactName)} />
                  <FieldError>{errors.emergencyContactName}</FieldError>
                </div>
                <div>
                  <Label required>Relation</Label>
                  <Select value={form.emergencyContactRelation} onChange={(e) => set('emergencyContactRelation')(e.target.value)}>
                    {['Wife', 'Husband', 'Sister', 'Brother', 'Father', 'Mother', 'Other'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label required>Emergency Contact Phone</Label>
                  <PhoneInput value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} error={Boolean(errors.emergencyContactPhone)} />
                  <FieldError>{errors.emergencyContactPhone}</FieldError>
                </div>
              </div>

              {selectedBus && (
                <Card className="mt-6 bg-slate-50 dark:bg-navy">
                  <CardHeader title="Selected Shift Summary" />
                  <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <SummaryStat label="Capacity" value={selectedBus.capacity ? `${selectedBus.capacity} Seater Coach` : 'Not set'} />
                    <SummaryStat label="Stops On Route" value={selectedRoute ? `${selectedRoute.stops?.length || 0} Scheduled Stops` : '—'} />
                    <SummaryStat label="Students On Route" value={selectedRoute ? `${selectedRoute.students?.length || 0} Registered Students` : '—'} />
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {step === 5 && <ReviewStep form={form} validation={validation} busOptions={busOptions} />}
        </CardBody>

        {createMutation.error && (
          <div className="mx-6 mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {createMutation.error.message}
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
            <Button as={Link} to="/drivers" variant="outline" type="button">
              Cancel
            </Button>
          )}
          {step === 3 && !validation?.valid && !validateMutation.isPending && (
            <Button onClick={() => validateMutation.mutate()} loading={validateMutation.isPending}>
              Check again
            </Button>
          )}
          {step < STEPS.length && (step !== 3 || validation?.valid) && (
            <Button onClick={goNext}>Continue</Button>
          )}
          {step === STEPS.length && (
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              Create Driver
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

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

function ReviewStep({ form, validation, busOptions }) {
  const bus = busOptions.find((b) => b._id === form.assignedBus);
  const route = bus?.assignedRoute;
  return (
    <div className="space-y-6">
      <h3 className="text-base font-bold text-slate-900 dark:text-white">Review Driver Profile</h3>

      <section>
        <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">1. Personal Information</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryStat label="Full Name" value={`${form.firstName} ${form.lastName}`} />
          <SummaryStat label="Phone Number" value={form.phone ? formatPhone(form.phone) : '—'} />
          <SummaryStat label="Email" value={form.email || '—'} />
        </div>
        <div className="mt-3">
          <SummaryStat label="Gender / DOB" value={`${form.gender} — ${form.dob || '—'}`} />
        </div>
      </section>

      <section>
        <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">2. License Details</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryStat label="License Number" value={form.licenseNumber} />
          <SummaryStat label="Expiry Date" value={form.licenseExpiry} />
          <SummaryStat label="License Class" value={form.licenseClass} />
        </div>
        <div className="mt-3">
          <SummaryStat label="License" value={validation?.valid ? 'Details saved' : 'Needs fixing'} />
        </div>
      </section>

      <section>
        <p className="mb-3 text-sm font-bold text-brand-700 dark:text-brand-400">3. Vehicle &amp; Route Assignment</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryStat label="Assigned Vehicle" value={bus ? `${bus.name} (${bus.plateNumber})` : '—'} />
          <SummaryStat label="Assigned Route" value={route ? route.name : '—'} />
          <SummaryStat
            label="Emergency Contact"
            value={form.emergencyContactName ? `${form.emergencyContactName} (${form.emergencyContactRelation})` : '—'}
          />
        </div>
      </section>
    </div>
  );
}

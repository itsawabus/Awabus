import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Unlink } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useEditDraft } from '../../hooks/useFormDraft.js';
import DraftNotice from '../../components/ui/DraftNotice.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { UNDO_SECONDS, useUndoDeleteStore } from '../../store/undoDeleteStore.js';
import LocationPickerModal from '../../components/ui/LocationPickerModal.jsx';
import GeofenceMap, { ACCRA_DEFAULT } from '../../components/map/GeofenceMap.jsx';
import { getStudent, updateStudent } from '../../api/students.js';
import HouseholdLinkPicker from '../../components/students/HouseholdLinkPicker.jsx';
import LanguageSelect from '../../components/students/LanguageSelect.jsx';
import { DEFAULT_LANGUAGE } from '../../lib/languages.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import { fromStoredPhone, isValidPhone, toLocalPhone } from '../../lib/phone.js';
import { RADIUS_MAX, RADIUS_MIN, coordsError, digitsOnly, formatCoord, formatName, ifChanged, nameError, radiusError } from '../../lib/formats.js';
import RideSessionPicker from '../../components/students/RideSessionPicker.jsx';
import GpsAddressInput from '../../components/ui/GpsAddressInput.jsx';
import ArrivalCallsToggle, { arrivalCallsLabel } from '../../components/students/ArrivalCallsToggle.jsx';

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [errors, setErrors] = useState({});

  const { data: student, isLoading } = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id) });

  usePageHeader({
    breadcrumb: [
      'AwaBus',
      'Students',
      { label: student ? `${student.firstName} ${student.lastName}` : '...', to: `/students/${id}` },
      'Edit',
    ],
  });

  const baseline = useMemo(
    () =>
      student
        ? {
            firstName: student.firstName,
            lastName: student.lastName,
            classGrade: student.classGrade || '',
            gender: student.gender || 'Female',
            guardianFirst: student.primaryGuardian?.firstName || '',
            guardianLast: student.primaryGuardian?.lastName || '',
            guardianPhone: fromStoredPhone(student.primaryGuardian?.phone),
            guardianLanguage: student.primaryGuardian?.preferredLanguage || DEFAULT_LANGUAGE,
            secondContactPhone: fromStoredPhone(student.secondContactPhone),
            homeAddress: student.homeAddress || '',
            lat: student.lat ?? ACCRA_DEFAULT.lat,
            lng: student.lng ?? ACCRA_DEFAULT.lng,
            geofenceRadius: student.geofenceRadius || 200,
            rideSession: student.rideSession || 'both',
            arrivalCalls: student.arrivalCalls !== false,
          }
        : null,
    [student]
  );
  // Unsaved edits are kept as a draft until saved or discarded; later refetches
  // (e.g. after linking a household) don't overwrite them.
  const [form, setForm, draft] = useEditDraft(`student:${id}`, baseline);

  const set = (key) => (val) => {
    setErrors((e) => ({ ...e, [key]: '', coords: key === 'lat' || key === 'lng' ? '' : e.coords }));
    setForm((f) => ({ ...f, [key]: val }));
  };

  const updateMutation = useMutation({
    mutationFn: (payload) => updateStudent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      draft.clear();
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      navigate(`/students/${id}`);
    },
  });

  // Link / unlink the shared home location immediately (separate from "Update Student").
  const householdMutation = useMutation({
    mutationFn: (payload) => updateStudent(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['student', id], updated);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-options'] });
      setForm((f) => ({
        ...f,
        homeAddress: updated.homeAddress ?? f.homeAddress,
        lat: updated.lat ?? f.lat,
        lng: updated.lng ?? f.lng,
        geofenceRadius: updated.geofenceRadius || f.geofenceRadius,
      }));
    },
  });

  const scheduleDelete = useUndoDeleteStore((st) => st.scheduleDelete);
  // The delete waits out the undo time (see undoDeleteStore); the list hides it meanwhile.
  const deleteWithUndo = () => {
    const label = `${student.firstName} ${student.lastName}`;
    scheduleDelete({
      title: label,
      items: [{ id, label, path: `/students/${id}` }],
      onFinished: () =>
        Promise.all([...['students', 'routes'], 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
    });
    navigate('/students');
  };

  if (isLoading || !form) return <PageLoader />;

  const householdMembers = student.householdMembers || [];
  const homeWithCalls = householdMembers.filter((m) => m.arrivalCalls !== false);

  return (
    <div>
      <PageHeader
        title="Edit Student Details"
        subtitle={`Modify information for ${student.firstName} ${student.lastName}. Ensure geofence coordinates are valid.`}
      />
      <DraftNotice show={draft.restored} onDiscard={draft.discard} discardLabel="Discard changes" />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValidPhone(form.guardianPhone) || (form.secondContactPhone && !isValidPhone(form.secondContactPhone))) {
            setPhoneError('Phone numbers must be 10 digits starting with 0, e.g. 024 412 3456');
            return;
          }
          setPhoneError('');
          const next = {
            firstName: ifChanged(form.firstName, baseline.firstName, () => nameError(form.firstName, 'First name')),
            lastName: ifChanged(form.lastName, baseline.lastName, () => nameError(form.lastName, 'Last name')),
            guardianFirst: ifChanged(form.guardianFirst, baseline.guardianFirst, () =>
              nameError(form.guardianFirst, 'First name', { required: false })
            ),
            guardianLast: ifChanged(form.guardianLast, baseline.guardianLast, () =>
              nameError(form.guardianLast, 'Last name', { required: false })
            ),
            coords:
              String(form.lat) === String(baseline.lat) && String(form.lng) === String(baseline.lng)
                ? ''
                : coordsError(form.lat, form.lng),
            geofenceRadius: ifChanged(form.geofenceRadius, baseline.geofenceRadius, () => radiusError(form.geofenceRadius)),
          };
          setErrors(next);
          if (Object.values(next).some(Boolean)) return;
          updateMutation.mutate({
            firstName: form.firstName,
            lastName: form.lastName,
            classGrade: form.classGrade,
            gender: form.gender,
            guardian: {
              id: student.primaryGuardian?._id,
              firstName: form.guardianFirst,
              lastName: form.guardianLast,
              phone: toLocalPhone(form.guardianPhone),
              preferredLanguage: form.guardianLanguage || DEFAULT_LANGUAGE,
            },
            secondContactPhone: toLocalPhone(form.secondContactPhone),
            homeAddress: form.homeAddress ?? baseline.homeAddress,
            lat: Number(form.lat),
            lng: Number(form.lng),
            geofenceRadius: Number(form.geofenceRadius),
            rideSession: form.rideSession || 'both',
            arrivalCalls: (form.arrivalCalls ?? baseline.arrivalCalls) !== false,
          });
        }}
      >
        <div className="space-y-6">
          {/* Student and guardian side by side, same height */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="h-full">
              <CardHeader title="Student & School Info" />
              <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label>Student ID</Label>
                  <Input disabled value={student.studentCode} />
                </div>
                <div>
                  <Label>First Name</Label>
                  <Input value={form.firstName} onChange={(e) => set('firstName')(formatName(e.target.value))} error={Boolean(errors.firstName)} />
                  <FieldError>{errors.firstName}</FieldError>
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input value={form.lastName} onChange={(e) => set('lastName')(formatName(e.target.value))} error={Boolean(errors.lastName)} />
                  <FieldError>{errors.lastName}</FieldError>
                </div>
                <div>
                  <Label>Class / Grade</Label>
                  <Input value={form.classGrade} onChange={(e) => set('classGrade')(e.target.value)} />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onChange={(e) => set('gender')(e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Rides</Label>
                  <RideSessionPicker value={form.rideSession} onChange={set('rideSession')} />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Students who ride one run only are left off the other run's trip.
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card className="h-full">
              <CardHeader title="Guardian Details" />
              <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Label>Guardian First Name</Label>
                  <Input value={form.guardianFirst} onChange={(e) => set('guardianFirst')(formatName(e.target.value))} error={Boolean(errors.guardianFirst)} />
                  <FieldError>{errors.guardianFirst}</FieldError>
                </div>
                <div>
                  <Label>Guardian Last Name</Label>
                  <Input value={form.guardianLast} onChange={(e) => set('guardianLast')(formatName(e.target.value))} error={Boolean(errors.guardianLast)} />
                  <FieldError>{errors.guardianLast}</FieldError>
                </div>
                <div>
                  <Label>Primary Phone Number</Label>
                  <PhoneInput value={form.guardianPhone} onChange={set('guardianPhone')} />
                </div>
                <div>
                  <Label>Backup Emergency Phone</Label>
                  <PhoneInput value={form.secondContactPhone} onChange={set('secondContactPhone')} placeholder="020 111 2233" />
                </div>
                <LanguageSelect value={form.guardianLanguage} onChange={set('guardianLanguage')} />
                <div className="sm:col-span-2">
                  <Label>Arrival calls</Label>
                  <ArrivalCallsToggle
                    value={form.arrivalCalls ?? baseline.arrivalCalls}
                    onChange={set('arrivalCalls')}
                    note={
                      (form.arrivalCalls ?? baseline.arrivalCalls) && homeWithCalls.length
                        ? `${homeWithCalls.map((m) => m.firstName).join(', ')} at the same home also ${homeWithCalls.length > 1 ? 'have' : 'has'} calls on. The parent is still called only once per trip.`
                        : ''
                    }
                  />
                </div>
                {phoneError && <p className="text-sm font-medium text-red-600 sm:col-span-2">{phoneError}</p>}
              </CardBody>
            </Card>
          </div>

          {/* Location: fields on the left, the map on the right */}
          <Card>
            <CardHeader
              title="Location & Geofencing"
              subtitle="Type the GPS address, click the map or drag the pin. The green circle is the notification zone."
            />
            <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
              <div className="grid grid-cols-1 content-start gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <GpsAddressInput
                    value={form.homeAddress ?? baseline.homeAddress}
                    onChange={set('homeAddress')}
                    onResolve={({ lat, lng }) => setForm((f) => ({ ...f, lat, lng }))}
                  />
                </div>
                <div>
                  <Label>Latitude</Label>
                  <Input inputMode="decimal" value={form.lat} onChange={(e) => set('lat')(formatCoord(e.target.value))} error={Boolean(errors.coords)} />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input inputMode="decimal" value={form.lng} onChange={(e) => set('lng')(formatCoord(e.target.value))} error={Boolean(errors.coords)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Geofence Radius (meters)</Label>
                  <Input inputMode="numeric" value={form.geofenceRadius} onChange={(e) => set('geofenceRadius')(digitsOnly(e.target.value, 4))} error={Boolean(errors.geofenceRadius)} />
                  <FieldError>{errors.geofenceRadius}</FieldError>
                  {!errors.geofenceRadius && <p className="mt-1.5 text-xs text-slate-400">Between {RADIUS_MIN} and {RADIUS_MAX} metres</p>}
                </div>
                {errors.coords && (
                  <div className="sm:col-span-2">
                    <FieldError>{errors.coords}</FieldError>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                    Open map picker
                  </Button>
                </div>
              </div>
              <div className="h-72 overflow-hidden rounded-xl sm:h-80 lg:h-auto lg:min-h-[20rem]">
                <GeofenceMap
                  lat={form.lat}
                  lng={form.lng}
                  radius={form.geofenceRadius}
                  onMove={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
                />
              </div>
            </CardBody>
              <LocationPickerModal
                open={mapOpen}
                onClose={() => setMapOpen(false)}
                lat={form.lat}
                lng={form.lng}
                radius={form.geofenceRadius}
                onConfirm={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
              />
            </Card>

            <Card>
              <CardHeader title="Shared Home Location" subtitle="Siblings or neighbours using the same home and geofence" />
              <CardBody>
                {householdMembers.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">Shares home location with:</p>
                    <ul className="space-y-2">
                      {householdMembers.map((m) => (
                        <li key={m._id} className="flex items-center gap-2 text-sm">
                          <Home className="h-4 w-4 text-green-600" />
                          <Link to={`/students/${m._id}`} className="font-semibold text-slate-800 hover:underline dark:text-slate-100">
                            {m.firstName} {m.lastName}
                          </Link>
                          <span className="text-xs text-slate-400">{[m.studentCode, m.classGrade].filter(Boolean).join(' · ')}</span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                              m.arrivalCalls !== false
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-navy dark:text-slate-400'
                            }`}
                          >
                            Calls {arrivalCallsLabel(m.arrivalCalls).toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Changing this student&apos;s location or geofence also updates the students listed above.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={householdMutation.isPending}
                      onClick={() => setConfirmUnlink(true)}
                    >
                      <Unlink className="h-4 w-4" />
                      Unlink from household
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pick a sibling or neighbour to copy their home location and keep both in sync.
                    </p>
                    <HouseholdLinkPicker
                      guardianId={student.primaryGuardian?._id}
                      excludeId={id}
                      onSelect={(s) => householdMutation.mutate({ linkLocationWith: s._id })}
                    />
                  </div>
                )}
                <ConfirmDialog
                  open={confirmUnlink}
                  title="Unlink from household?"
                  message={`${student.firstName} will stop sharing a home location with ${householdMembers
                    .map((m) => m.firstName)
                    .join(', ')}. Later location changes will no longer update the others.`}
                  confirmLabel="Unlink"
                  loading={householdMutation.isPending}
                  onClose={() => setConfirmUnlink(false)}
                  onConfirm={() =>
                    householdMutation.mutate({ unlinkLocation: true }, { onSettled: () => setConfirmUnlink(false) })
                  }
                />
                {householdMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">{householdMutation.error.message}</p>
                )}
              </CardBody>
            </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm font-semibold text-red-600 hover:underline"
              >
                Remove Student
              </button>
              <div className="flex gap-3">
                <Button as={Link} to={`/students/${id}`} variant="outline" type="button">
                  Cancel
                </Button>
                <Button type="submit" loading={updateMutation.isPending}>
                  Update Student
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </form>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Remove this student?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteWithUndo}>
              Delete Student
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;ll have {UNDO_SECONDS} seconds to undo. After that it&apos;s permanent.</p>
      </Modal>
    </div>
  );
}

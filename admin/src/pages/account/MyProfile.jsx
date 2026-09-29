import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Phone } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Input, { Label, FieldError } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import PhotoUpload from '../../components/ui/PhotoUpload.jsx';
import AccountTabs, { SuccessNote } from '../../components/account/AccountTabs.jsx';
import ChangeContactModal from '../../components/account/ChangeContactModal.jsx';
import { updateProfile } from '../../api/account.js';
import { useAuthStore } from '../../store/authStore.js';
import { formatPhone } from '../../lib/phone.js';
import { formatDate } from '../../lib/utils.js';

export default function MyProfile() {
  usePageHeader({ breadcrumb: ['AwaBus', 'My profile'] });
  const { admin, updateAdmin } = useAuthStore();
  const [form, setForm] = useState({ name: admin?.name || '', avatarUrl: admin?.avatarUrl || '' });
  const [changing, setChanging] = useState(null); // 'email' | 'phone' | null
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setForm({ name: admin?.name || '', avatarUrl: admin?.avatarUrl || '' });
  }, [admin?.name, admin?.avatarUrl]);

  const mutation = useMutation({
    mutationFn: () => updateProfile({ name: form.name.trim(), avatarUrl: form.avatarUrl }),
    onSuccess: (updated) => {
      updateAdmin(updated);
      setNotice('Profile saved');
    },
  });

  const dirty = form.name.trim() !== (admin?.name || '') || form.avatarUrl !== (admin?.avatarUrl || '');

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your personal details and how AwaBus contacts you." />
      <AccountTabs />
      <SuccessNote message={notice} onDone={() => setNotice('')} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" />
          <CardBody className="space-y-5">
            <div>
              <Label>Profile photo</Label>
              <PhotoUpload value={form.avatarUrl} onChange={(avatarUrl) => setForm((f) => ({ ...f, avatarUrl }))} />
            </div>
            <div>
              <Label required>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={!form.name.trim()}
              />
              <FieldError>{!form.name.trim() ? 'Name is required' : mutation.error?.message}</FieldError>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={!dirty || !form.name.trim()}
                loading={mutation.isPending}
              >
                Save changes
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact details" subtitle="Changes are confirmed with a code sent to the new email or number." />
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ContactRow
                icon={Mail}
                label="Email address"
                value={admin?.email || 'Not set'}
                onChange={() => setChanging('email')}
              />
              <ContactRow
                icon={Phone}
                label="Phone number"
                value={admin?.phone ? formatPhone(admin.phone) : 'Not set'}
                onChange={() => setChanging('phone')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Account" />
            <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Info label="Role" value={admin?.role === 'superadmin' ? 'Platform superadmin' : 'School administrator'} />
              <Info label="Member since" value={admin?.createdAt ? formatDate(admin.createdAt) : '—'} />
            </CardBody>
          </Card>
        </div>
      </div>

      <ChangeContactModal
        type={changing}
        open={Boolean(changing)}
        onClose={() => setChanging(null)}
        onChanged={setNotice}
      />
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);

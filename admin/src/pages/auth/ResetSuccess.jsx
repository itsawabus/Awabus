import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';

export default function ResetSuccess() {
  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="mb-4 h-16 w-16 text-brand-500" />
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Password reset successful</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You can now sign in with your new password
        </p>
        <Button as={Link} to="/sign-in" variant="auth" className="mt-8 w-full">
          Return to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}

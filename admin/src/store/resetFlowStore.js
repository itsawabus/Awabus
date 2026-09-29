import { create } from 'zustand';

// Carries state between the Forgot Password → Verify OTP → Create New Password screens.
export const useResetFlowStore = create((set) => ({
  email: '',
  resetToken: '',
  setEmail: (email) => set({ email }),
  setResetToken: (resetToken) => set({ resetToken }),
  clear: () => set({ email: '', resetToken: '' }),
}));

import { create } from 'zustand';

// Carries state between Forgot Password → Verify OTP → Create New Password.
// Lives only in memory — this flow never needs to survive an app restart.
export const useResetFlowStore = create((set) => ({
  phone: '',
  resetToken: '',
  setPhone: (phone) => set({ phone }),
  setResetToken: (resetToken) => set({ resetToken }),
  clear: () => set({ phone: '', resetToken: '' }),
}));

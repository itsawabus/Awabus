// Arkesel reports a call by campaign id and recipient number. When its reply to
// "place call" carries no id we can use, a call is matched by the last 9 digits
// of the recipient's number instead (0593595328, 233593595328 and +233... agree).
export const phoneKey = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? `phone:${digits.slice(-9)}` : '';
};

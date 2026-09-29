// Password-reset tokens (handed out after a correct reset code).
// - Signed with their own key, so one can never be used as a sign-in token.
// - Carry the account's passwordChangedAt at the time of issue: once the
//   password has been reset (which changes it), the same token stops working,
//   so each token works once.
import jwt from 'jsonwebtoken';

const secret = () => `${process.env.JWT_SECRET}:password-reset`;
const stamp = (account) => (account?.passwordChangedAt ? new Date(account.passwordChangedAt).getTime() : 0);

export const signResetToken = (payload, account) => jwt.sign({ ...payload, pca: stamp(account) }, secret(), { expiresIn: '15m' });

/** The payload, or null when the token is bad, expired or already used. */
export function readResetToken(token, loadAccount) {
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return { error: 'Reset session expired. Please restart the password reset process.' };
  }
  return {
    payload,
    check: async () => {
      const account = await loadAccount(payload);
      if (!account) return { error: 'Account not found', status: 404 };
      if (payload.pca !== stamp(account)) return { error: 'This reset session has already been used. Please restart the password reset process.' };
      return { account };
    },
  };
}

// Sign-in tokens made before the password last changed no longer work.
export const issuedBeforePasswordChange = (decoded, account) =>
  Boolean(account?.passwordChangedAt && decoded?.iat && decoded.iat * 1000 < new Date(account.passwordChangedAt).getTime());

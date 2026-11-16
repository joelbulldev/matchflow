export type FieldErrors = Record<string, string>

export function validateForgotLogin(login: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!login.trim()) errors.login = 'Enter the email or username for your account.'
  return errors
}

export function validateResetPassword(fields: { login: string; key: string; password: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.login.trim()) errors.login = 'Enter your email or username.'
  if (!fields.key.trim()) errors.key = 'Paste the reset key from your email.'
  if (fields.password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}

export function validateLogin(login: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!login.trim()) errors.login = 'Enter your email or username.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function validateRegister(fields: {
  displayName: string
  username: string
  email: string
  password: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.displayName.trim()) errors.displayName = 'Add a display name for your profile.'
  if (!fields.username.trim()) errors.username = 'Choose a username (letters, numbers, underscores).'
  else if (!/^[a-zA-Z0-9_]{3,32}$/.test(fields.username)) errors.username = 'Username must be 3–32 characters: letters, numbers, underscore.'
  if (!fields.email.trim()) errors.email = 'Enter your work email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = 'Enter a valid email address (e.g. you@company.com).'
  if (fields.password.length < 8) errors.password = 'Use at least 8 characters for your password.'
  return errors
}

export function nearWalletHelpMessage(error: unknown): { message: string; retryable: boolean } {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('cancel')) {
    return { message: 'Wallet request was cancelled. Open your NEAR wallet and try again when ready.', retryable: true }
  }
  if (lower.includes('challenge')) {
    return { message: 'Sign-in session expired. Select “Try NEAR again” to fetch a fresh challenge.', retryable: true }
  }
  if (lower.includes('signature')) {
    return { message: 'Wallet did not return a signature. Confirm the sign message prompt in your wallet.', retryable: true }
  }
  return { message: raw || 'NEAR wallet connection failed. Check the extension and network, then retry.', retryable: true }
}

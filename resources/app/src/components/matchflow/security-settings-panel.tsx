import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, LogOut, Monitor, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FormField, SectionCard } from '@/components/matchflow'
import { api } from '@/lib/api-client'
import { mfToast } from '@/lib/mutation-feedback'
import { useNearAuth } from '@/auth/NearAuthContext'
import { useSession } from '@/hooks/use-session'

type SessionRow = {
  id: string
  ip: string
  userAgent: string
  loginAt: string | null
  current: boolean
}

function shortenUa(ua: string) {
  if (!ua) return 'Unknown browser'
  if (ua.length <= 72) return ua
  return `${ua.slice(0, 68)}…`
}

export function SecuritySettingsPanel() {
  const { user } = useSession()
  const { logout } = useNearAuth()
  const qc = useQueryClient()
  const [otpOpen, setOtpOpen] = useState(false)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api<{ sessions: SessionRow[] }>('/auth/sessions'),
  })

  const requestOtp = useMutation({
    mutationFn: () => api('/auth/password-otp/request', { method: 'POST' }),
    onSuccess: () => {
      mfToast.success('Verification code sent', 'Check your email for a 6-digit code.')()
      setOtpOpen(true)
    },
    onError: mfToast.error('Could not send code'),
  })

  const confirmOtp = useMutation({
    mutationFn: () =>
      api('/auth/password-otp/confirm', {
        method: 'POST',
        body: JSON.stringify({ otp, password }),
      }),
    onSuccess: () => {
      mfToast.success('Password updated')()
      setOtpOpen(false)
      setOtp('')
      setPassword('')
      setConfirm('')
    },
    onError: mfToast.error('Could not update password'),
  })

  const revoke = useMutation({
    mutationFn: (sessionId: string) => api(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      mfToast.success('Session ended')()
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
    onError: mfToast.error('Could not end session'),
  })

  const isEmailAccount = Boolean(user?.email && !user.email.endsWith('@near.local'))
  const canSubmitPassword = password.length >= 8 && password === confirm && otp.length === 6

  return (
  <>
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Password
          </CardTitle>
          <CardDescription>
            {isEmailAccount
              ? 'Change your password with a one-time code sent to your email.'
              : 'You signed in with a wallet. Email accounts can set a password here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEmailAccount ? (
            <Button type="button" onClick={() => requestOtp.mutate()} disabled={requestOtp.isPending}>
              {requestOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
              Send verification code
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Link an email address from Profile if you need password sign-in for your team.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="size-4 text-primary" aria-hidden />
            This session
          </CardTitle>
          <CardDescription>Sign out on this device when you are done working.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>

    <SectionCard
      title="Logged-in devices"
      description="Browsers and devices with an active MATCHFLOW session. End any session you do not recognize."
      className="max-w-3xl"
    >
      {sessions.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sessions…</p>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {(sessions.data?.sessions ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {s.current ? 'This device' : 'Other device'}
                {s.current ? <span className="ml-2 text-xs font-normal text-primary">Active now</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{shortenUa(s.userAgent)}</p>
              <p className="text-xs text-muted-foreground">
                {s.ip ? `IP ${s.ip}` : 'IP unknown'}
                {s.loginAt ? ` · Signed in ${new Date(s.loginAt).toLocaleString()}` : null}
              </p>
            </div>
            {!s.current ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="End session"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(s.id)}
              >
                <LogOut className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
        {!sessions.isLoading && !(sessions.data?.sessions?.length) ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No other sessions found.</li>
        ) : null}
      </ul>
    </SectionCard>

    <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>Enter the 6-digit code from your email and choose a new password.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <FormField label="Verification code">
            <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
          </FormField>
          <FormField label="New password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm password">
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </FormField>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOtpOpen(false)}>Cancel</Button>
          <Button type="button" disabled={!canSubmitPassword || confirmOtp.isPending} onClick={() => confirmOtp.mutate()}>
            {confirmOtp.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  )
}

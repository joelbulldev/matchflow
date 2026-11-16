import { toast } from '@/lib/toast'

export function toastOnSuccess(title: string, description?: string) {
  return () => toast.success(title, description)
}

export function toastOnError(title: string) {
  return (error: Error) => toast.error(title, error.message)
}

export const mfToast = {
  success: toastOnSuccess,
  error: toastOnError,
}

import { toast as sonner } from 'sonner'

export const toast = {
  success: (message: string, description?: string) => sonner.success(message, { description, id: message }),
  error: (message: string, description?: string) => sonner.error(message, { description, id: `${message}-error` }),
  info: (message: string, description?: string) => sonner.info(message, { description }),
  warning: (message: string, description?: string) => sonner.warning(message, { description }),
  promise: sonner.promise,
  dismiss: sonner.dismiss,
}

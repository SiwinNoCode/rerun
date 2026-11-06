import { CaptchaError } from '@/components/auth/captcha/captcha-error'
import { detectInAppBrowser } from '@/lib/in-app-browser'
import { track } from '@rerun/analytics/client'

const MESSAGE_LIMIT = 200

// A refusal from the server, with the reason analytics reports.
export class EmailSendError extends Error {
    constructor(
        message: string,
        readonly reason: string
    ) {
        super(message)
    }
}

function failure(error: unknown) {
    if (error instanceof CaptchaError) return error.analytics
    if (error instanceof EmailSendError) return { reason: error.reason }
    return { reason: 'client_error', message: (error instanceof Error ? error.message : String(error)).slice(0, MESSAGE_LIMIT) }
}

// Every "Send code" by email that sends nothing ends in `email_verification_failed`, whether the
// robot check turned the visitor away, the server refused, or the call itself broke.
export async function trackEmailSend<T>(send: () => Promise<T>): Promise<T> {
    try {
        return await send()
    } catch (error) {
        track('email_verification_failed', { ...failure(error), in_app_browser: detectInAppBrowser(navigator.userAgent) ?? undefined })
        throw error
    }
}

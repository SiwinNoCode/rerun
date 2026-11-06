import type { PhoneSendActionResult } from '@/app/api/_actions/phone.actions'
import type { PhoneCodeRequest } from '@/components/auth/PhoneCodeForm'
import { CaptchaError } from '@/components/auth/captcha/captcha-error'
import type { VerificationChannel } from '@/lib/phone/verification'
import type { PhoneVerificationContext } from '@rerun/analytics'
import { track } from '@rerun/analytics/client'

const MESSAGE_LIMIT = 200

// A refusal from the server: `retryAfterSeconds` is how long it holds the next code back, `reason`
// why it turned this one away.
export class PhoneSendError extends Error {
    constructor(
        message: string,
        readonly retryAfterSeconds?: number,
        readonly reason?: string
    ) {
        super(message)
    }
}

// Every "Send by…" ends in `phone_verification_sent` or `phone_verification_failed`, whether the
// server refused, the robot check never answered, or the call itself broke.
export async function sendPhoneCode(context: PhoneVerificationContext, request: PhoneCodeRequest, send: () => Promise<PhoneSendActionResult>): Promise<VerificationChannel> {
    const failed = (details: { reason: string; message?: string; captcha_provider?: CaptchaError['provider']; captcha_code?: string }) => track('phone_verification_failed', { channel: request.channel, context, country: request.country, ...details })

    let result: PhoneSendActionResult
    try {
        result = await send()
    } catch (error) {
        if (error instanceof CaptchaError) failed(error.analytics)
        else failed({ reason: 'client_error', message: (error instanceof Error ? error.message : String(error)).slice(0, MESSAGE_LIMIT) })
        throw error
    }
    if (!result.ok) {
        failed({ reason: result.reason })
        throw new PhoneSendError(result.error, result.retryAfterSeconds, result.reason)
    }
    track('phone_verification_sent', { channel: result.channel, context })
    return result.channel
}

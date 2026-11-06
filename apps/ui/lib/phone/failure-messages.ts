import type { PhoneChangeFailure } from '@/app/api/_services/phone-sign-in.service'
import type { PhoneVerificationFailure } from '@/app/api/_services/phone-verification.service'

export type PhoneFailure = PhoneVerificationFailure | PhoneChangeFailure | 'captcha_failed' | 'signed_out'

export const PHONE_FAILURE_MESSAGES: Record<PhoneFailure, string> = {
    taken: 'This number already signs into another Rerun account.',
    same_number: 'This is already the number of your account.',
    not_required: 'Your phone number is already verified.',
    too_soon: 'A code is already on its way. Wait a moment before asking for a new one.',
    too_many: 'Too many codes requested for this number. Try again later.',
    invalid_number: 'Enter a valid mobile number.',
    unsupported_country: "We can't send codes to this country yet. Use email or Google instead.",
    undeliverable: "We couldn't deliver a code to this number. Try the other channel, or use email or Google.",
    blocked: "We can't send a code to this number. Use email or Google instead.",
    rate_limited: 'Too many attempts on this number. Try again later.',
    wrong_code: 'This code is wrong or has expired.',
    expired: 'This code has expired. Ask for a new one.',
    unavailable: 'We could not reach your phone. Try again, or use the other channel.',
    busy: 'Phone sign-in is busy right now. Use email or Google instead.',
    captcha_failed: 'We could not confirm you are not a robot. Try again.',
    signed_out: 'Create your account first.',
}

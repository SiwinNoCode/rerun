export type VerificationChannel = 'sms' | 'whatsapp'

export const isVerificationChannel = (value: unknown): value is VerificationChannel => value === 'sms' || value === 'whatsapp'

export const VERIFICATION_CODE_LENGTH = 6

export const PHONE_REQUIRED_MESSAGE = 'Confirm your phone number to keep going.'

// Where an account stands with its phone step. `none` is an account the step was never asked of
// (older than it, an invitee, a mobile signup), `pending` the one the wall stands in front of,
// `unverifiable` a number the wall took in without a code (the column kept its first name, from
// when only countries no code reaches went without one), which counts as done.
export type PhoneStatus = 'none' | 'pending' | 'skipped' | 'unverifiable' | 'verified'

export const PHONE_STATUS_COLUMNS = ['verified_at', 'skipped_at', 'unverifiable_at'] as const

export function phoneStatusOf(row: { verified_at: string | null; skipped_at: string | null; unverifiable_at: string | null } | null): PhoneStatus {
    if (!row) return 'none'
    if (row.verified_at) return 'verified'
    if (row.unverifiable_at) return 'unverifiable'
    return row.skipped_at ? 'skipped' : 'pending'
}

export const isPhoneStepDone = (status: PhoneStatus) => status === 'verified' || status === 'unverifiable'

// Bird turns a malformed tag away with the 422 it also answers for a number it cannot reach, so
// only a tag that parses is passed on. Without one Bird reads the language off the number's country.
export function verificationLanguage(acceptLanguage: string | null | undefined): string | null {
    const tag = (acceptLanguage ?? '')
        .split(',')
        .map(part => part.trim().split(';')[0])
        .find(Boolean)
    if (!tag) return null

    try {
        return new Intl.Locale(tag).baseName
    } catch {
        return null
    }
}

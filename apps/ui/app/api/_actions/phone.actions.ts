'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { type PhoneAccount } from '@/app/api/_services/phone-ownership.service'
import { completePhoneChange, completePhoneSignIn, startPhoneChange, startPhoneSignIn, type SessionTokens } from '@/app/api/_services/phone-sign-in.service'
import { confirmPhoneVerification, skipPhoneVerification, startPhoneVerification } from '@/app/api/_services/phone-verification.service'
import { callerIp } from '@/lib/auth/caller-ip'
import { verifyCaptcha } from '@/lib/auth/captcha'
import { captchaProofSchema } from '@/lib/auth/captcha-proof'
import { PHONE_FAILURE_MESSAGES, type PhoneFailure } from '@/lib/phone/failure-messages'
import { countryOfE164, isPhoneCountry, toE164 } from '@/lib/phone/normalize'
import { reachableChannels } from '@/lib/phone/reach'
import { VERIFICATION_CODE_LENGTH, verificationLanguage, type VerificationChannel } from '@/lib/phone/verification'
import { createClient } from '@/supabase/server'

// `reason` is what the client reports to analytics, `error` what it shows.
export type PhoneActionRefusal = { ok: false; error: string; reason: PhoneFailure; retryAfterSeconds?: number }
export type PhoneActionResult = { ok: true } | PhoneActionRefusal
export type PhoneSendActionResult = { ok: true; channel: VerificationChannel } | PhoneActionRefusal
export type PhoneSignInActionResult = { ok: true; created: boolean; session: SessionTokens } | PhoneActionRefusal

const sendSchema = z.object({
    phone: z.string().trim().min(1).max(32),
    country: z.string().refine(isPhoneCountry),
    channel: z.enum(['sms', 'whatsapp']),
})

const signInSendSchema = sendSchema.extend({ captcha: captchaProofSchema.optional() })

const signInSchema = sendSchema.extend({ code: z.string().regex(new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`)) })

const codeSchema = z.object({ code: z.string().regex(new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`)) })

const unverifiableSchema = sendSchema.omit({ channel: true })


const refused = (reason: PhoneFailure, retryAfterSeconds?: number): PhoneActionRefusal => ({
    ok: false,
    error: PHONE_FAILURE_MESSAGES[reason],
    reason,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
})

const invalidNumber = () => refused('invalid_number')

// The logs keep why a send was turned away, beside what Bird answered.
function sendRefused(result: { error: PhoneFailure; retryAfterSeconds?: number }, { channel, country }: { channel: VerificationChannel; country: string }): PhoneActionRefusal {
    console.warn('[phone] send refused', result.error, channel, country)
    return refused(result.error, result.retryAfterSeconds)
}

const callerLanguage = (requestHeaders: Headers) => verificationLanguage(requestHeaders.get('accept-language'))

async function accountUserId(): Promise<string | null> {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user && !data.user.is_anonymous ? data.user.id : null
}

export async function sendPhoneCodeAction(input: z.input<typeof sendSchema>): Promise<PhoneSendActionResult> {
    const parsed = sendSchema.safeParse(input)
    if (!parsed.success || !isPhoneCountry(parsed.data.country)) return invalidNumber()
    const phone = toE164(parsed.data.phone, parsed.data.country)
    if (!phone) return invalidNumber()

    const userId = await accountUserId()
    if (!userId) return refused('signed_out')

    const result = await startPhoneVerification(userId, phone, parsed.data.channel, callerLanguage(await headers()))
    return result.ok ? result : sendRefused(result, parsed.data)
}

export async function verifyPhoneCodeAction(input: z.input<typeof codeSchema>): Promise<PhoneActionResult> {
    const parsed = codeSchema.safeParse(input)
    if (!parsed.success) return refused('wrong_code')

    const userId = await accountUserId()
    if (!userId) return refused('signed_out')

    const result = await confirmPhoneVerification(userId, parsed.data.code)
    return result.ok ? result : refused(result.error)
}

export async function skipPhoneStepAction(): Promise<PhoneActionResult> {
    const userId = await accountUserId()
    if (!userId) return refused('signed_out')
    return (await skipPhoneVerification(userId)) ? { ok: true } : refused('unavailable')
}

// A number in a country no code reaches enters as it is. The country is read off the number again
// here: one a code does reach is turned away, or anyone could pass the step without a code.
export async function continueWithoutCodeAction(input: z.input<typeof unverifiableSchema>): Promise<PhoneActionResult> {
    const parsed = unverifiableSchema.safeParse(input)
    const phone = parsed.success ? signInPhone(parsed.data) : null
    if (!phone) return invalidNumber()
    if (reachableChannels(countryOfE164(phone), 'verify').length > 0) return refused('reachable_country')

    const userId = await accountUserId()
    if (!userId) return refused('signed_out')
    return (await skipPhoneVerification(userId, phone)) ? { ok: true } : refused('unavailable')
}

function signInPhone(input: { phone: string; country: string }): string | null {
    return isPhoneCountry(input.country) ? toE164(input.phone, input.country) : null
}

export async function sendPhoneSignInCodeAction(input: z.input<typeof signInSendSchema>): Promise<PhoneSendActionResult> {
    const parsed = signInSendSchema.safeParse(input)
    const phone = parsed.success ? signInPhone(parsed.data) : null
    if (!parsed.success || !phone) return invalidNumber()

    const requestHeaders = await headers()
    const ip = callerIp(requestHeaders)
    if (!(await verifyCaptcha(parsed.data.captcha, ip))) return refused('captcha_failed')

    const result = await startPhoneSignIn(phone, parsed.data.channel, ip, callerLanguage(requestHeaders))
    return result.ok ? result : sendRefused(result, parsed.data)
}

// Signs the visitor into the account this number holds, or creates it.
export async function verifyPhoneSignInCodeAction(input: z.input<typeof signInSchema>): Promise<PhoneSignInActionResult> {
    const parsed = signInSchema.safeParse(input)
    const phone = parsed.success ? signInPhone(parsed.data) : null
    if (!parsed.success || !phone) return refused('wrong_code')

    const result = await completePhoneSignIn(await createClient(), phone, parsed.data.code, parsed.data.channel)
    return result.ok ? result : refused(result.error)
}

async function signedInAccount(): Promise<PhoneAccount | null> {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user && !data.user.is_anonymous ? { id: data.user.id, email: data.user.email ?? null } : null
}

const signInFirst = (): PhoneActionRefusal => ({ ...refused('signed_out'), error: 'Sign in to change your number.' })

// The number a signed-in account adds or moves to, from its account settings.
export async function sendPhoneChangeCodeAction(input: z.input<typeof sendSchema>): Promise<PhoneSendActionResult> {
    const parsed = sendSchema.safeParse(input)
    const phone = parsed.success ? signInPhone(parsed.data) : null
    if (!parsed.success || !phone) return invalidNumber()

    const account = await signedInAccount()
    if (!account) return signInFirst()

    const requestHeaders = await headers()
    const result = await startPhoneChange(account, phone, parsed.data.channel, callerIp(requestHeaders), callerLanguage(requestHeaders))
    return result.ok ? result : sendRefused(result, parsed.data)
}

export async function verifyPhoneChangeCodeAction(input: z.input<typeof signInSchema>): Promise<PhoneActionResult> {
    const parsed = signInSchema.safeParse(input)
    const phone = parsed.success ? signInPhone(parsed.data) : null
    if (!parsed.success || !phone) return refused('wrong_code')

    const account = await signedInAccount()
    if (!account) return signInFirst()

    const result = await completePhoneChange(account, phone, parsed.data.code, parsed.data.channel)
    return result.ok ? result : refused(result.error)
}

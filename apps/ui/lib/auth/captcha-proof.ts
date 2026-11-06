import { z } from 'zod'

export const CAPTCHA_PROVIDERS = ['turnstile', 'hcaptcha'] as const
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number]

// What a browser hands the server as proof it is not a script: the token, and which service minted it.
export const captchaProofSchema = z.object({ provider: z.enum(CAPTCHA_PROVIDERS), token: z.string().max(4096) })
export type CaptchaProof = z.infer<typeof captchaProofSchema>

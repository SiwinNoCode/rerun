import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeSupabase, writeMethodOf } from '@/test/supabase-fake'

vi.mock('server-only', () => ({}))

let supabase = fakeSupabase()
vi.mock('@/supabase/serviceRole', () => ({ createServiceRoleClient: () => supabase.client }))

const NOW = Date.parse('2026-10-06T12:00:00Z')

const { skipPhoneVerification } = await import('./phone-verification.service')

beforeEach(() => {
    vi.useFakeTimers({ now: NOW })
    supabase = fakeSupabase((table, calls) => (table === 'user_phones' && writeMethodOf(calls) ? { error: null } : undefined))
})

describe('skipPhoneVerification', () => {
    it('lets the account in without a number, and leaves a verified one alone', async () => {
        expect(await skipPhoneVerification('user-1')).toBe(true)
        const [skip] = supabase.writes('user_phones')
        expect(skip.payload).toEqual({ skipped_at: new Date(NOW).toISOString() })
        expect(skip.filters.map(call => [call.method, ...call.args])).toEqual([
            ['eq', 'user_id', 'user-1'],
            ['is', 'verified_at', null],
        ])
    })

    it('keeps the number given without a code with its consent, and counts it done', async () => {
        expect(await skipPhoneVerification('user-1', '+33612345678')).toBe(true)
        const stamp = new Date(NOW).toISOString()
        expect(supabase.writes('user_phones').map(write => write.payload)).toEqual([{ skipped_at: stamp, phone: '+33612345678', unverifiable_at: stamp, contact_consent_at: stamp }])
    })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSentCode, readSentCode, SENT_CODE_KEPT_MS, writeSentCode } from './sent-code'

const NOW = Date.parse('2026-10-14T08:00:00Z')
const REQUEST = { phone: '0612345678', country: 'FR' as const, channel: 'whatsapp' as const }

function memoryStorage(): Storage {
    const items = new Map<string, string>()
    return {
        get length() {
            return items.size
        },
        clear: () => items.clear(),
        getItem: key => items.get(key) ?? null,
        key: index => [...items.keys()][index] ?? null,
        removeItem: key => void items.delete(key),
        setItem: (key, value) => void items.set(key, value),
    }
}

beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage())
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('sent code', () => {
    it('gives back the code sent before the tab was reloaded', () => {
        writeSentCode('phone-sign-in', REQUEST, NOW)

        expect(readSentCode('phone-sign-in', NOW + 30_000)).toEqual({ request: REQUEST, sentAt: NOW })
    })

    it('keeps each form to its own code', () => {
        writeSentCode('phone-sign-in', REQUEST, NOW)

        expect(readSentCode('phone-change', NOW)).toBeNull()
    })

    it('forgets a code Bird has forgotten too', () => {
        writeSentCode('phone-sign-in', REQUEST, NOW)

        expect(readSentCode('phone-sign-in', NOW + SENT_CODE_KEPT_MS + 1)).toBeNull()
    })

    it('forgets a code once verified or abandoned', () => {
        writeSentCode('phone-sign-in', REQUEST, NOW)
        clearSentCode('phone-sign-in')

        expect(readSentCode('phone-sign-in', NOW)).toBeNull()
    })

    it('ignores what it did not write itself', () => {
        sessionStorage.setItem('phone-code-sent:phone-sign-in', '{"request":{"phone":"1","country":"XX","channel":"sms"},"sentAt":1}')
        expect(readSentCode('phone-sign-in', NOW)).toBeNull()

        sessionStorage.setItem('phone-code-sent:phone-sign-in', 'not json')
        expect(readSentCode('phone-sign-in', NOW)).toBeNull()
    })

    it('does without storage where the browser refuses it', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => {
                throw new Error('SecurityError')
            },
            setItem: () => {
                throw new Error('SecurityError')
            },
            removeItem: () => {
                throw new Error('SecurityError')
            },
        })

        expect(() => writeSentCode('phone-sign-in', REQUEST, NOW)).not.toThrow()
        expect(readSentCode('phone-sign-in', NOW)).toBeNull()
        expect(() => clearSentCode('phone-sign-in')).not.toThrow()
    })
})

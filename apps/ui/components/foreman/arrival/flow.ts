import { TRIAL_DAYS } from '@rerun/contracts'
import type { UIMessage } from 'ai'

// Someone who arrived on a template or on a shared coworker goes through the column instead of the
// welcome card: an account, a phone number, the trial, the template's own price when it has one, then
// the install, which asks nothing of them.

export const ARRIVAL_STEPS = ['account', 'phone', 'trial', 'purchase', 'installing'] as const
export type ArrivalStep = (typeof ARRIVAL_STEPS)[number]

// What the visitor counts: the phone number belongs to the account, and a free template has no
// price of its own to pay.
export function arrivalGestures(paid: boolean): string[] {
    return paid ? ['Account', 'Free trial', 'Template', 'Installed'] : ['Account', 'Free trial', 'Installed']
}

export function gestureIndex(step: ArrivalStep, paid: boolean): number {
    if (step === 'account' || step === 'phone') return 0
    if (step === 'trial') return 1
    if (step === 'purchase') return 2
    return paid ? 3 : 2
}

export function arrivalHeading(step: ArrivalStep, name: string): { title: string; description: string } {
    switch (step) {
        case 'account':
            return { title: `Put ${name} to work`, description: `Create your account and ${name} is installed for you. No setup form, no questions first.` }
        case 'phone':
            return { title: 'One last step', description: `Add your phone number. ${name} is next.` }
        case 'trial':
            return { title: `Try ${name} for ${TRIAL_DAYS} days`, description: `${name} is installed the second your trial starts.` }
        case 'purchase':
            return { title: `Get ${name}`, description: 'Your trial is on. This template has its own price, and it is installed right after.' }
        case 'installing':
            return { title: `Installing ${name}`, description: 'Nothing to do here. This takes under a minute.' }
    }
}

type LoosePart = { type: string }

/** Read off the session and the conversation, so a reload or the way back from Google lands on the right step. */
export function arrivalStepOf({ isAnonymous, phonePending, messages }: { isAnonymous: boolean; phonePending: boolean; messages: UIMessage[] }): ArrivalStep {
    if (isAnonymous) return 'account'
    if (phonePending) return 'phone'
    const parts = messages.flatMap(message => message.parts as LoosePart[])
    if (parts.some(part => part.type === 'tool-build_team')) return 'installing'
    if (parts.some(part => part.type === 'tool-open_template_purchase')) return 'purchase'
    return 'trial'
}

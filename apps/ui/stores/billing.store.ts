import { create } from 'zustand'
import type { AddonKey } from '@rerun/cloud/billing'

// The trial's coworker cap: the checkout opens straight on paying now, which is what lifts it. The
// value is the one `paywall_viewed` has always carried for this gate, so its series stays whole.
export const AGENT_LIMIT_TRIGGER = 'entitlement_gate'

type BillingState = {
    open: boolean
    highlightAddon: AddonKey | null
    // What surfaced the paywall (trial_pill, budget_exhausted, entitlement_gate, template_content, …), for `paywall_viewed`.
    trigger: string | null
    // Ouvre le dialog billing, optionnellement en mettant un add-on en avant (ex. depuis un feature gate).
    openBilling: (highlight?: AddonKey, trigger?: string) => void
    setOpen: (open: boolean) => void
}

export const useBillingStore = create<BillingState>(set => ({
    open: false,
    highlightAddon: null,
    trigger: null,
    openBilling: (highlight, trigger) => set({ open: true, highlightAddon: highlight ?? null, trigger: trigger ?? 'manual' }),
    // Reset du highlight à la fermeture pour ne pas le retrouver à la réouverture via le menu.
    setOpen: open => set(open ? { open } : { open: false, highlightAddon: null, trigger: null }),
}))

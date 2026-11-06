'use client'

// Hook client qui lie la limite snapshotée du workspace (max_agents) aux compteurs du board,
// et expose un point d'entrée unique `gate()` pour ouvrir le BillingDialog sur ce qui lève la
// limite. Les Box ne sont pas comptées : elles rangent les agents et ne coûtent rien.
//
// Côté agents la limite porte sur les agents ACTIFS : un workspace peut en stocker autant qu'il
// veut, ceux qui dépassent restent éteints. « Plus de slot » n'empêche donc pas de créer, ça
// détermine seulement dans quel état l'agent arrive.
//
// `max_agents` est un snapshot du plan souscrit, pas la limite du moment : un abonnement fini la
// ramène à zéro. `activeAgentLimitFor` est la même fonction que celle du gate serveur.

import { activeAgentLimitFor } from '@rerun/cloud/billing'
import { AGENT_LIMIT_TRIGGER, useBillingStore } from '@/stores/billing.store'
import { useBoardStore } from '@/stores/board.store'
import { useSession } from '@/supabase/session/SessionProvider'
import { useMemo } from 'react'

export function useEntitlements() {
    const { workspace } = useSession()
    const activeAgentsCount = useBoardStore(s => s.agents.filter(a => !a.disabledAt).length)
    const openBilling = useBillingStore(s => s.openBilling)

    // Tant que le workspace n'est pas là, la limite est inconnue plutôt que nulle : afficher
    // « aucun slot » le temps d'une hydratation ferait clignoter un mur qui n'existe pas.
    const maxAgents = workspace ? activeAgentLimitFor(workspace.max_agents, workspace.subscription_status) : null

    return useMemo(() => {
        return {
            activeAgentsCount,
            maxAgents,
            // Un agent créé sans slot libre naît éteint : c'est ce que cette valeur sert à annoncer,
            // pas à bloquer la création.
            noFreeAgentSlot: maxAgents !== null && activeAgentsCount >= maxAgents,
            // Un import de template pose plusieurs agents d'un coup : `noFreeAgentSlot` ne regarde
            // que le suivant, il laisserait passer un lot qui dépasse la limite. Le compteur est relu
            // au moment de l'appel : le board peut finir d'hydrater entre le render et le clic.
            agentsRoomFor: (count: number): { ok: boolean } => {
                const total = useBoardStore.getState().agents.filter(a => !a.disabledAt).length + count
                return { ok: maxAgents === null || total <= maxAgents }
            },
            // Seul un trial a encore une limite : le billing s'ouvre sur le paiement immédiat, qui la lève.
            gate: () => openBilling(undefined, AGENT_LIMIT_TRIGGER),
        }
    }, [maxAgents, activeAgentsCount, openBilling])
}

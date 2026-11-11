import { pendingCodexPlanLimits } from './codex-plan-limits.js'
import { pendingOpencodePlanLimits } from './opencode-plan-limits.js'
import type { LoadedConnection } from './types.js'

// A run's end starts a read of its plan's limits and the hub asks for the list right after it: the
// list waits for that read, so the rings it draws are the run's. Capped, since a CLI that hangs
// must not hold the pickers; and only for reads already under way, never for a stale one started
// by this very list.
const PENDING_PLAN_LIMITS_MAX_WAIT_MS = 5_000

export async function awaitPendingPlanLimits(connections: LoadedConnection[]): Promise<void> {
    const pending = connections.flatMap(connection => [pendingCodexPlanLimits(connection.id), pendingOpencodePlanLimits(connection.id)].filter((read): read is Promise<void> => !!read))
    if (!pending.length) return
    let cap: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
        Promise.all(pending),
        new Promise<void>(resolve => {
            cap = setTimeout(resolve, PENDING_PLAN_LIMITS_MAX_WAIT_MS)
        }),
    ])
    if (cap) clearTimeout(cap)
}

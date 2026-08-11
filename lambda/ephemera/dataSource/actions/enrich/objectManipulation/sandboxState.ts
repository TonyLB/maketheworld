import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

/**
 * Multi-host working state for the plan-compiler sandbox. Mirrors
 * `applyHostEffects.ts`'s own `graphsByHost` pattern (SB-4) --- one
 * `EphemeraLudicGraph` snapshot per affected host, no bespoke type.
 */
export type SandboxState = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

export function buildSandboxState(graphs: EphemeraLudicGraph[]): SandboxState {
    const state: SandboxState = new Map()
    for (const graph of graphs) {
        state.set(graph.hostId, graph)
    }
    return state
}

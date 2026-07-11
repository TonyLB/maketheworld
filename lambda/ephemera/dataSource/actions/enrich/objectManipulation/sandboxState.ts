import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../../positions/positionGraph'

/**
 * Multi-host working state for the plan-compiler sandbox. Mirrors
 * `applyHostEffects.ts`'s own `graphsByHost` pattern (SB-4) --- one
 * `EphemeraPositionGraph` snapshot per affected host, no bespoke type.
 */
export type SandboxState = Map<EphemeraMembershipHostId, EphemeraPositionGraph>

export function buildSandboxState(graphs: EphemeraPositionGraph[]): SandboxState {
    const state: SandboxState = new Map()
    for (const graph of graphs) {
        state.set(graph.hostId, graph)
    }
    return state
}

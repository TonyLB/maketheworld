import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind, EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/**
 * `from`/`to` are `EphemeraLudicTerminalId` (LP7), mirroring `ludicGraph/baseClasses.ts`'s
 * `HostRelationalEdge` --- a pre-existing duplication (not consolidated in this slice); see
 * `ludicGraph/AGENT.md`'s "Relational edge names" table.
 */
type HostRelationalEdgeBase = {
    from: EphemeraLudicTerminalId
    to: EphemeraLudicTerminalId
}

export type HostRelationalEdge =
    | (HostRelationalEdgeBase & { kind: Exclude<HostRelationalEdgeKind, 'Custom'> })
    | (HostRelationalEdgeBase & { kind: 'Custom'; relationLabel: string })

/**
 * One add/remove of an in-host relational edge on a fixed host graph (Room or
 * Character) --- `EphemeraLudicGraph.applyRelationalPatch`'s own input
 * shape (`ludicGraph/index.ts`), still load-bearing after
 * `applyHostRelationalPatch.ts`/`planHostRelationalPatch.ts` retired (Migrate
 * slice, 2026-07-23): every relational-effect call site builds one of these
 * directly now instead of through that retired coordinator layer.
 */
export type HostRelationalPatch = {
    hostId: EphemeraMembershipHostId
    edge: HostRelationalEdge
    op: 'add' | 'remove'
}

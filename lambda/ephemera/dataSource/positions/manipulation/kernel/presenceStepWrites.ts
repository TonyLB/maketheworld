import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { isBystanderMove } from './bystander'
import { settleMembership } from './settleMembership'
import type { SettleMembershipOutcome } from './settleMembership'
import { withEntries, withoutEntries } from './endOfRunRules'

/**
 * The cover index for a pointer write that is not a move (`addPresenceBinding`, `repairPresenceBinding`):
 * the entry for `host`'s binding leaves every parent binding it pointed at (`before`) that it no longer
 * does, and arrives at every one it points at now (`after`), as a move writes it. A parent in both sets
 * is untouched. A bystander's room is not in the footprint and keeps its coverage in the characters row;
 * a parent binding that is absent has no index to correct (drift owns it).
 */
export const writeCoverIndex = (
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>,
    host: EphemeraMembershipHostId,
    presence: EphemeraPresenceNodeId,
    before: readonly ParentBinding[],
    after: readonly ParentBinding[]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => {
    const next = new Map(graphs)
    const entry = { host: host as Parameters<typeof withEntries>[1][number]['host'], presence }
    const write = (parent: ParentBinding, change: typeof withEntries) => {
        if (isBystanderMove(host, parent.host)) {
            return
        }
        const parentGraph = next.get(parent.host)
        const binding = parentGraph?.presenceNodes.find(({ universalKey }) => universalKey === parent.presence)
        if (parentGraph && binding) {
            next.set(parent.host, parentGraph.replacePresenceNode({ ...binding, cover: change(binding.cover, [entry]) }))
        }
    }
    const keyOf = (parent: ParentBinding): string => `${parent.host}|${parent.presence}`
    const afterKeys = new Set(after.map(keyOf))
    before.filter((parent) => !afterKeys.has(keyOf(parent))).forEach((parent) => write(parent, withoutEntries))
    // `after` is written whole, as a single-parent write always was: re-adding an entry is idempotent
    after.forEach((parent) => write(parent, withEntries))
    return next
}

/**
 * Settles membership for a pointer write whose parent set changed: the mover leaves each host it no
 * longer sits under and arrives at each host it now does. `settleMembership` takes one host each way, so
 * departures run first, then arrivals.
 */
export const settleParentChange = (
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>,
    mover: EphemeraMembershipHostId,
    left: EphemeraMembershipHostId[],
    arrived: EphemeraMembershipHostId[]
): SettleMembershipOutcome => (
    [...left.map((host) => ({ left: host })), ...arrived.map((host) => ({ arrived: host }))].reduce<SettleMembershipOutcome>(
        (outcome, change) => outcome.verdict === 'legal' ? settleMembership(outcome.graphs, mover, change) : outcome,
        { verdict: 'legal', graphs }
    )
)

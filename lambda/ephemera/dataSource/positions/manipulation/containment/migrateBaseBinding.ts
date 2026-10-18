import { BASE_PRESENCE_ID, isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { baseMigrationHolderOf, coveredByBinding } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelRenamePresenceBindingStep } from '../kernel/kernelStep'

const viewOf = (graph: EphemeraLudicGraph): PresenceGraphView => ({
    hostId: graph.hostId,
    nodeIds: [...graph.nodeIds],
    presenceNodes: graph.presenceNodes,
})

/**
 * The Base migration for one whole (monotoneCovers Slice 5): the step that gives the whole's original
 * binding the fixed id `PRESENCE#Base` and, if its cover holds a `Remainder`, lists the members the
 * `Remainder` stood for. Stored data from before monotone covers is the only input it acts on.
 *
 * The holder is `baseMigrationHolderOf` (the one lookup the retired fallback made: a Room's or Area's
 * hostless binding, else another whole's only binding). Each member the `Remainder` covered is listed
 * by the binding of its own that points at the holder; a member with no such binding, or two, or an
 * unreadable graph, makes the whole unmigratable for now: the result is `[]`, because listing the rest
 * would leave that member uncovered (the end-of-run check throws on it). Population runs first and
 * gives such a member its binding, so a leftover is real drift and keeps the sweep reading non-zero.
 * A holder already named Base is left alone: one step migrates a whole completely, so Base holding a
 * `Remainder` is not a state this migration produces or repairs.
 *
 * `bystanders` are a Room's present characters (the characters row): they point at the holder and are in
 * no cover, so the step names them as children to rewrite.
 */
export const migrateBaseBinding = (
    whole: EphemeraLudicGraph,
    memberGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined,
    bystanders: readonly EphemeraMembershipHostId[] = []
): MutationKernelRenamePresenceBindingStep[] => {
    const view = viewOf(whole)
    const holder = baseMigrationHolderOf(view)
    if (!holder || holder.universalKey === BASE_PRESENCE_ID) {
        return []
    }
    const holderId = holder.universalKey as MutationKernelRenamePresenceBindingStep['from']
    const hasRemainder = holder.cover.members.some(isEphemeraPresenceCoverRemainder)
    const listed = holder.cover.members.filter((member): member is EphemeraPresenceCoverEntry => !isEphemeraPresenceCoverRemainder(member))

    let entries: EphemeraPresenceCoverEntry[] = listed
    if (hasRemainder) {
        const listedHosts = new Set(listed.map(({ host }) => host as string))
        const expanded: EphemeraPresenceCoverEntry[] = []
        for (const member of coveredByBinding(view).get(holderId) ?? []) {
            if (listedHosts.has(member)) {
                continue
            }
            const pointed = memberGraph(member as EphemeraMembershipHostId)?.presenceNodes.filter((binding) => (
                binding.fromHostPresence?.host === whole.hostId && binding.fromHostPresence.presence === holderId
            )) ?? []
            if (pointed.length !== 1) {
                return []
            }
            expanded.push({ host: member as EphemeraPresenceCoverEntry['host'], presence: pointed[0].universalKey })
        }
        entries = [...listed, ...expanded]
    }

    const childHosts = [...new Set([...entries.map(({ host }) => host as EphemeraMembershipHostId), ...bystanders])]
    return [{
        kind: 'renamePresenceBinding',
        hostId: whole.hostId,
        from: holderId,
        to: BASE_PRESENCE_ID,
        ...(holder.fromHostPresence ? { parent: { host: holder.fromHostPresence.host as EphemeraMembershipHostId, presence: holder.fromHostPresence.presence as MutationKernelRenamePresenceBindingStep['from'] } } : {}),
        ...(hasRemainder ? { cover: { members: entries } } : {}),
        childHosts,
    }]
}

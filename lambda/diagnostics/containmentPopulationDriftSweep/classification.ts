import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

type RawPresenceNode = {
    tag?: unknown
    fromHostPresence?: { host?: unknown; presence?: unknown }
    cover?: { members?: unknown }
}

const hasNoParentPointer = (node: RawPresenceNode): boolean => !node.fromHostPresence

/**
 * The parents whose cache-time containment population would now write one of `ownerId`'s presence
 * bindings differently. Read from the raw stored row, since this lambda cannot import ephemera's
 * `presenceParent`. A binding is drift when it is a Room's binding into an Area whose cover is
 * anything but an empty-member carve-out (a).
 *
 * And one check on the owner itself: (b) a Room or Area with no binding lacking a parent pointer, the root of its
 * presence tree, which every Room and Area keeps whatever it contains (reported with the owner as
 * the parent, since population mints it for the owner). A row with no stored graph yet counts.
 *
 * A row whose stored shape the guard rejects (e.g. the retired host-only `fromHostId`) is not this
 * sweep's: the heal could not read it, so it reports through `LudicGraphStaleStructureSweep`.
 *
 * **Deliberately a superset** of `containmentPopulationSteps`' wrong-shape test, not a second theory
 * of it: the consumer reruns that same population, which rechecks before writing, so a false
 * positive costs one no-op heal while a false negative would hide drift. Only Room, Feature and
 * Area owners are classified --- the population this finding reruns writes only their bindings
 * (an Area's only its root), so a Character's or Object's binding is outside what the heal can
 * repair. A pointer naming a host but no binding is not checked here: `presence` is required, so the
 * stored-row guard rejects it and `LudicGraphStaleStructureSweep` reports it.
 */
export const containmentDriftParentsOf = (ownerId: string, ludicGraph: unknown): EphemeraMembershipHostId[] => {
    if (!(isEphemeraRoomId(ownerId) || isEphemeraFeatureId(ownerId) || isEphemeraAreaId(ownerId))) {
        return []
    }
    const storedNodes = (ludicGraph as { nodes?: unknown } | undefined)?.nodes
    const nodes = (Array.isArray(storedNodes) ? storedNodes : []) as RawPresenceNode[]
    const parents = new Set<EphemeraMembershipHostId>()
    if ((isEphemeraRoomId(ownerId) || isEphemeraAreaId(ownerId)) && !nodes.some((node) => node?.tag === 'Presence' && hasNoParentPointer(node))) {
        parents.add(ownerId)
    }
    for (const node of nodes) {
        if (!node || typeof node !== 'object' || node.tag !== 'Presence') {
            continue
        }
        const parent = node.fromHostPresence?.host
        if (typeof parent !== 'string' || !isEphemeraMembershipHostId(parent)) {
            continue
        }
        const members = node.cover?.members
        const roomAreaNotCarveOut = isEphemeraRoomId(ownerId) && isEphemeraAreaId(parent) && !(Array.isArray(members) && members.length === 0)
        if (roomAreaNotCarveOut) {
            parents.add(parent)
        }
    }
    return [...parents]
}

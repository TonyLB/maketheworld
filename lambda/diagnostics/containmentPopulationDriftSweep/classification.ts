import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

type RawPresenceNode = {
    tag?: unknown
    fromHostPresence?: { host?: unknown; presence?: unknown }
    cover?: { members?: unknown }
}

const isHostlessRemainder = (node: RawPresenceNode): boolean => (
    !node.fromHostPresence &&
    Array.isArray(node.cover?.members) &&
    (node.cover.members as unknown[]).some((member) => (member as { tag?: unknown } | null)?.tag === 'Remainder')
)

/**
 * The parents whose cache-time containment population would now write one of `ownerId`'s presence
 * bindings differently. Read from the raw stored row, since this lambda cannot import ephemera's
 * `presenceParent`. A binding is drift when either holds:
 *
 * - (a) its `fromHostPresence` names no parent binding (every Room and Area keeps a hostless
 *   remainder for its children to name, so a host-only pointer at one is drift);
 * - (b) it is a Room's binding into an Area whose cover is anything but an empty-member carve-out.
 *
 * And one check on the owner itself: (c) a Room or Area with no hostless remainder, the root of its
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
 * repair. A parent with several bindings is a legitimate host-only case (its children cannot name one) that (a) still
 * reports; the heal reruns and writes nothing.
 */
export const containmentDriftParentsOf = (ownerId: string, ludicGraph: unknown): EphemeraMembershipHostId[] => {
    if (!(isEphemeraRoomId(ownerId) || isEphemeraFeatureId(ownerId) || isEphemeraAreaId(ownerId))) {
        return []
    }
    const storedNodes = (ludicGraph as { nodes?: unknown } | undefined)?.nodes
    const nodes = (Array.isArray(storedNodes) ? storedNodes : []) as RawPresenceNode[]
    const parents = new Set<EphemeraMembershipHostId>()
    if ((isEphemeraRoomId(ownerId) || isEphemeraAreaId(ownerId)) && !nodes.some((node) => node?.tag === 'Presence' && isHostlessRemainder(node))) {
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
        const unnamedParentBinding = node.fromHostPresence?.presence === undefined
        const members = node.cover?.members
        const roomAreaNotCarveOut = isEphemeraRoomId(ownerId) && isEphemeraAreaId(parent) && !(Array.isArray(members) && members.length === 0)
        if (unnamedParentBinding || roomAreaNotCarveOut) {
            parents.add(parent)
        }
    }
    return [...parents]
}

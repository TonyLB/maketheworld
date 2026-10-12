import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

type RawPresenceNode = {
    tag?: unknown
    fromHostId?: unknown
    fromHostPresence?: { host?: unknown; presence?: unknown }
    cover?: { members?: unknown }
}

const parentHostOf = (node: RawPresenceNode): unknown => node.fromHostPresence?.host ?? node.fromHostId

const isHostlessRemainder = (node: RawPresenceNode): boolean => (
    !node.fromHostPresence && node.fromHostId === undefined &&
    Array.isArray(node.cover?.members) &&
    (node.cover.members as unknown[]).some((member) => (member as { tag?: unknown } | null)?.tag === 'Remainder')
)

/**
 * The parents whose cache-time containment population would now write one of `ownerId`'s presence
 * bindings differently. Read from the raw stored row, since this lambda cannot import ephemera's
 * `presenceParent`. A binding is drift when any of these holds:
 *
 * - (a) it stores the legacy host-only `fromHostId` and no `fromHostPresence`;
 * - (b) its `fromHostPresence` names no parent binding and the parent is not an Area (an Area holds
 *   no bindings, so a host-only pointer at one is the correct shape);
 * - (c) it is a Room's binding into an Area whose cover is anything but an empty-member carve-out.
 *
 * And one check on the owner itself: (d) a Room with no hostless remainder, the root of its presence
 * tree, which every room keeps whatever it contains (reported with the Room as the parent, since
 * population mints it for the Room). A Room row with no stored graph yet counts.
 *
 * **Deliberately a superset** of `containmentPopulationSteps`' wrong-shape test, not a second theory
 * of it: the consumer reruns that same population, which rechecks before writing, so a false
 * positive costs one no-op heal while a false negative would hide drift. Only Room and Feature
 * owners are classified --- the population this finding reruns writes only their bindings, so a
 * Character's or Object's binding is outside what the heal can repair.
 */
export const containmentDriftParentsOf = (ownerId: string, ludicGraph: unknown): EphemeraMembershipHostId[] => {
    if (!(isEphemeraRoomId(ownerId) || isEphemeraFeatureId(ownerId))) {
        return []
    }
    const storedNodes = (ludicGraph as { nodes?: unknown } | undefined)?.nodes
    const nodes = (Array.isArray(storedNodes) ? storedNodes : []) as RawPresenceNode[]
    const parents = new Set<EphemeraMembershipHostId>()
    if (isEphemeraRoomId(ownerId) && !nodes.some((node) => node?.tag === 'Presence' && isHostlessRemainder(node))) {
        parents.add(ownerId)
    }
    for (const node of nodes) {
        if (!node || typeof node !== 'object' || node.tag !== 'Presence') {
            continue
        }
        const parent = parentHostOf(node)
        if (typeof parent !== 'string' || !isEphemeraMembershipHostId(parent)) {
            continue
        }
        const legacy = !node.fromHostPresence
        const unnamedParentBinding = Boolean(node.fromHostPresence) && node.fromHostPresence?.presence === undefined && !isEphemeraAreaId(parent)
        const members = node.cover?.members
        const roomAreaNotCarveOut = isEphemeraRoomId(ownerId) && isEphemeraAreaId(parent) && !(Array.isArray(members) && members.length === 0)
        if (legacy || unnamedParentBinding || roomAreaNotCarveOut) {
            parents.add(parent)
        }
    }
    return [...parents]
}

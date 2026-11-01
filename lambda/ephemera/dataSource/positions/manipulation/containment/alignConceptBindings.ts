import { v4 as uuidv4 } from 'uuid'
import type { EphemeraConceptId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraConceptId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { bindingHasParent, parentsOf } from '../../ludicGraph/presenceParent'
import type { MutationKernelAddPresenceBindingStep } from '../kernel/kernelStep'

/** A room a member is seen in: the room, and the member's own binding there is read off the member's graph by the caller. */
export type AlignmentRoom = { roomId: EphemeraRoomId; roomBindingId: EphemeraPresenceNodeId }

/** A physical member of a Concept, with the rooms its live bindings put it in. */
export type AlignmentMember = {
    memberId: EphemeraObjectId
    graph: EphemeraLudicGraph
    rooms: AlignmentRoom[]
}

/** A Concept, its direct physical members and its Concept parts (`PartOf`), each part a tree of the same shape. */
export type AlignmentTree = {
    conceptId: EphemeraConceptId
    graph: EphemeraLudicGraph
    members: AlignmentMember[]
    parts: AlignmentTree[]
}

const roomsOf = (tree: AlignmentTree): Map<EphemeraRoomId, EphemeraPresenceNodeId> => {
    const rooms = new Map<EphemeraRoomId, EphemeraPresenceNodeId>()
    const collect = (node: AlignmentTree): void => {
        node.members.forEach((member) => member.rooms.forEach(({ roomId, roomBindingId }) => {
            if (!rooms.has(roomId)) {
                rooms.set(roomId, roomBindingId)
            }
        }))
        node.parts.forEach(collect)
    }
    collect(tree)
    return rooms
}

/**
 * The pure alignment rule (AK-10, first iteration): room state in, the Concept bindings that
 * should exist out, as kernel steps. A Concept is present in a room because one of its members is
 * (AK-3), so the **outermost** Concept holds the room's binding and everything nested sits beneath it, as a
 * physical whole's room binding carries its parts. Under that binding go a binding for each nested
 * Concept that has a member in the room, and under each Concept's binding an `Associated` binding of each of
 * its members in that room.
 *
 * **Only adds.** A member's presence is evidence of relevance, not its definition, so nothing is ever removed
 * (a binding whose last member left stays; an authored room child with no member present is never touched).
 * **Idempotent**: a binding that already exists (a Concept binding with a parent on the room, a member
 * binding naming the Concept's binding) emits nothing, so a rerun over aligned state commits no transaction.
 * The caller reads each member's rooms from the member's live bindings; this function reads no store.
 *
 * `mintId` is injected so tests can name the bindings.
 */
export const alignConceptBindings = (
    tree: AlignmentTree,
    mintId: () => string = uuidv4
): MutationKernelAddPresenceBindingStep[] => {
    const steps: MutationKernelAddPresenceBindingStep[] = []

    // Places `node` under the binding `parentPointer` names in `roomId`, and everything below it.
    const place = (
        node: AlignmentTree,
        roomId: EphemeraRoomId,
        parentPointer: { host: EphemeraRoomId | EphemeraConceptId; presence: EphemeraPresenceNodeId }
    ): void => {
        const existing = node.graph.presenceNodes.find((binding) => bindingHasParent(binding, parentPointer))
        let ownBindingId = existing?.universalKey
        if (!ownBindingId) {
            const presenceUuid = mintId()
            ownBindingId = PresenceKey(presenceUuid) as EphemeraPresenceNodeId
            steps.push({ kind: 'addPresenceBinding', hostId: node.conceptId, fromHostPresences: [parentPointer], presenceUuid })
        }
        const own = { host: node.conceptId, presence: ownBindingId }
        node.members.filter((member) => member.rooms.some((room) => room.roomId === roomId)).forEach((member) => {
            if (!member.graph.presenceNodes.some((binding) => bindingHasParent(binding, own))) {
                steps.push({ kind: 'addPresenceBinding', hostId: member.memberId, fromHostPresences: [own], presenceUuid: mintId() })
            }
        })
        node.parts.filter((part) => roomsOf(part).has(roomId)).forEach((part) => place(part, roomId, own))
    }

    roomsOf(tree).forEach((roomBindingId, roomId) => place(tree, roomId, { host: roomId, presence: roomBindingId }))
    return steps
}

/**
 * Reads the alignment input for a Concept from stored graphs: its `Associated` Object members (with
 * the rooms their own bindings put them in) and its `PartOf` Concept parts, recursively. A member
 * with no binding under a Room has no room yet and contributes none (aligned later, once it is
 * placed). `visited` guards a malformed cycle of parts.
 */
export const loadAlignmentTree = async (
    conceptId: EphemeraConceptId,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    visited: ReadonlySet<EphemeraConceptId> = new Set()
): Promise<AlignmentTree> => {
    const graph = await getGraph(conceptId)
    const nodes = graph.componentNodes.filter(({ universalKey }) => universalKey !== conceptId)
    const members = await Promise.all(
        nodes
            .filter((node) => isEphemeraObjectId(node.universalKey) && node.hostingKind === 'Associated')
            .map(async ({ universalKey }): Promise<AlignmentMember> => {
                const memberGraph = await getGraph(universalKey as EphemeraObjectId)
                const rooms = memberGraph.presenceNodes.flatMap((binding) => parentsOf(binding)
                    .filter(({ host }) => isEphemeraRoomId(host))
                    .map(({ host, presence }) => ({ roomId: host as EphemeraRoomId, roomBindingId: presence })))
                return { memberId: universalKey as EphemeraObjectId, graph: memberGraph, rooms }
            })
    )
    const nextVisited = new Set([...visited, conceptId])
    const parts = await Promise.all(
        nodes
            .filter((node) => isEphemeraConceptId(node.universalKey) && node.hostingKind === 'PartOf' && !nextVisited.has(node.universalKey as EphemeraConceptId))
            .map(({ universalKey }) => loadAlignmentTree(universalKey as EphemeraConceptId, getGraph, nextVisited))
    )
    return { conceptId, graph, members, parts }
}

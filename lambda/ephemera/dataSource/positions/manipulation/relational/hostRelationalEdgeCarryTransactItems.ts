import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { fromCharacterMeta, fromRoomMeta, type HostRelationalEdge } from '../../positionGraph'
import type { HostRelationalEdgeCarry } from '../types'

export type HostRelationalEdgeCarryTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const toHostRelationalEdge = (carriedEdge: HostRelationalEdgeCarry): HostRelationalEdge => ({
    from: carriedEdge.edge.from,
    to: carriedEdge.edge.to,
    kind: carriedEdge.edge.kind,
    ...(carriedEdge.edge.relationLabel !== undefined ? { relationLabel: carriedEdge.edge.relationLabel } : {}),
})

/**
 * Additive, host-agnostic edge-carry transact items (BD-13 slice 1). This is a
 * *carry*, not an *add*: the relationship already existed --- an object set moving
 * hosts together is simply preserving a pre-existing fact, not a player asserting a
 * new one --- so it mirrors the sandbox's existing use of
 * `EphemeraPositionGraph.addRelationalEdge` (enrich/objectManipulation/sandboxStep.ts),
 * which is deliberately host-agnostic, rather than going through
 * `EphemeraPositionGraph.applyRelationalPatch` (create/destroy a fact via
 * `establishRelation`/`dissolveRelation`). Deliberately kept separate from that
 * pathway even after it generalizes beyond Room-only hosts (BD-15/BD-16) --- the two
 * answer different questions (carry an existing fact across a move vs. create or
 * destroy a fact outright), not just "which hosts are legal."
 */
export const buildHostRelationalEdgeCarryTransactItems = (
    carriedEdges: HostRelationalEdgeCarry[]
): HostRelationalEdgeCarryTransactItem[] => {
    const transactItems: HostRelationalEdgeCarryTransactItem[] = []

    for (const carriedEdge of carriedEdges) {
        const edge = toHostRelationalEdge(carriedEdge)

        if (isEphemeraRoomId(carriedEdge.hostId)) {
            transactItems.push({
                Update: {
                    Key: { EphemeraId: carriedEdge.hostId, DataCategory: 'Meta::Room' },
                    updateKeys: ['positionGraph'],
                    updateReducer: (draft) => {
                        const graph = fromRoomMeta(draft, carriedEdge.hostId)
                        draft.positionGraph = graph.addRelationalEdge(edge).toStored()
                    },
                },
            })
        }
        else if (isEphemeraCharacterId(carriedEdge.hostId)) {
            transactItems.push({
                Update: {
                    Key: { EphemeraId: carriedEdge.hostId, DataCategory: 'Meta::Character' },
                    updateKeys: ['positionGraph'],
                    updateReducer: (draft) => {
                        const graph = fromCharacterMeta(draft, carriedEdge.hostId)
                        draft.positionGraph = graph.addRelationalEdge(edge).toStored()
                    },
                },
            })
        }
    }

    return transactItems
}

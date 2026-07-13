import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { fromCharacterMeta, fromRoomMeta, type HostRelationalEdge } from '../../positionGraph'
import type { HostRelationalEdgeRecreation } from '../types'

export type HostRelationalEdgeRecreationTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const toHostRelationalEdge = (recreation: HostRelationalEdgeRecreation): HostRelationalEdge => ({
    from: recreation.edge.from,
    to: recreation.edge.to,
    kind: recreation.edge.kind,
    ...(recreation.edge.relationLabel !== undefined ? { relationLabel: recreation.edge.relationLabel } : {}),
})

/**
 * Additive, host-agnostic edge-recreation transact items (BD-13 slice 1). Recreation
 * is always an add: it mirrors the sandbox's existing use of
 * `EphemeraPositionGraph.addRelationalEdge` (enrich/objectManipulation/sandboxStep.ts),
 * which is deliberately host-agnostic. This does NOT go through
 * `EphemeraPositionGraph.applyRelationalPatch`, which intentionally hard-guards to
 * Room-only hosts for the player-initiated establish/dissolve pathway (BD-6).
 */
export const buildHostRelationalEdgeRecreationTransactItems = (
    recreations: HostRelationalEdgeRecreation[]
): HostRelationalEdgeRecreationTransactItem[] => {
    const transactItems: HostRelationalEdgeRecreationTransactItem[] = []

    for (const recreation of recreations) {
        const edge = toHostRelationalEdge(recreation)

        if (isEphemeraRoomId(recreation.hostId)) {
            transactItems.push({
                Update: {
                    Key: { EphemeraId: recreation.hostId, DataCategory: 'Meta::Room' },
                    updateKeys: ['positionGraph'],
                    updateReducer: (draft) => {
                        const graph = fromRoomMeta(draft, recreation.hostId)
                        draft.positionGraph = graph.addRelationalEdge(edge).toStored()
                    },
                },
            })
        }
        else if (isEphemeraCharacterId(recreation.hostId)) {
            transactItems.push({
                Update: {
                    Key: { EphemeraId: recreation.hostId, DataCategory: 'Meta::Character' },
                    updateKeys: ['positionGraph'],
                    updateReducer: (draft) => {
                        const graph = fromCharacterMeta(draft, recreation.hostId)
                        draft.positionGraph = graph.addRelationalEdge(edge).toStored()
                    },
                },
            })
        }
    }

    return transactItems
}

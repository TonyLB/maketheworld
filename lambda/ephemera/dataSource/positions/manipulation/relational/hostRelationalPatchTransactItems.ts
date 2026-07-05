import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { effectiveRoomPositionGraph } from '../../membership/positionGraphMerge'
import type { HostRelationalPatch } from '../types'
import {
    addRelationalEdgeToGraph,
    type ObservedHostRelationalEdge,
    removeRelationalEdgeFromGraph,
} from './relationalEdges'

export type HostRelationalPatchTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

export const buildHostRelationalPatchTransactItems = (
    patches: HostRelationalPatch[]
): HostRelationalPatchTransactItem[] => {
    const transactItems: HostRelationalPatchTransactItem[] = []

    for (const patch of patches) {
        const observedEdge: ObservedHostRelationalEdge = {
            from: patch.edge.from,
            to: patch.edge.to,
            kind: patch.edge.kind,
            ...(patch.edge.relationLabel !== undefined ? { relationLabel: patch.edge.relationLabel } : {}),
        }

        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: patch.hostId,
                    DataCategory: 'Meta::Room',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    const graph = effectiveRoomPositionGraph(draft)
                    draft.positionGraph = patch.op === 'add'
                        ? addRelationalEdgeToGraph(graph, observedEdge)
                        : removeRelationalEdgeFromGraph(graph, observedEdge)
                },
            },
        })
    }

    return transactItems
}

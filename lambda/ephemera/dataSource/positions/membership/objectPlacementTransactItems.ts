import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import {
    addObjectToGraph,
    effectiveRoomPositionGraph,
    removeObjectFromGraph,
} from './positionGraphMerge'
import type { MembershipDiff } from './types'

export type ObjectPlacementTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

export const buildObjectPlacementTransactItems = (args: {
    objectId: EphemeraObjectId;
    diff: MembershipDiff;
}): ObjectPlacementTransactItem[] => {
    const transactItems: ObjectPlacementTransactItem[] = []

    for (const departureRoomId of args.diff.froms) {
        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: departureRoomId,
                    DataCategory: 'Meta::Room',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    const graph = effectiveRoomPositionGraph(draft)
                    draft.positionGraph = removeObjectFromGraph(graph, args.objectId)
                },
            },
        })
        transactItems.push({
            Delete: {
                EphemeraId: args.objectId,
                DataCategory: buildPositionAdjacencyDataCategory(departureRoomId),
            },
        })
    }

    if (args.diff.to) {
        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: args.diff.to,
                    DataCategory: 'Meta::Room',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    const graph = effectiveRoomPositionGraph(draft)
                    draft.positionGraph = addObjectToGraph(graph, args.objectId)
                },
            },
        })
        transactItems.push({
            Put: {
                EphemeraId: args.objectId,
                DataCategory: buildPositionAdjacencyDataCategory(args.diff.to),
            },
        })
    }

    return transactItems
}

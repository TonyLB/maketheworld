import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import {
    addCharacterToGraph,
    effectiveRoomPositionGraph,
    removeCharacterFromGraph,
} from './positionGraphMerge'
import type { MembershipDiff } from './types'

export type CharacterRoomMembershipTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

export const buildCharacterRoomMembershipTransactItems = (args: {
    characterId: EphemeraCharacterId
    diff: MembershipDiff
}): CharacterRoomMembershipTransactItem[] => {
    const transactItems: CharacterRoomMembershipTransactItem[] = []

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
                    draft.positionGraph = removeCharacterFromGraph(graph, args.characterId)
                },
            },
        })
        transactItems.push({
            Delete: {
                EphemeraId: args.characterId,
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
                    draft.positionGraph = addCharacterToGraph(graph, args.characterId)
                },
            },
        })
        transactItems.push({
            Put: {
                EphemeraId: args.characterId,
                DataCategory: buildPositionAdjacencyDataCategory(args.diff.to),
            },
        })
    }

    return transactItems
}

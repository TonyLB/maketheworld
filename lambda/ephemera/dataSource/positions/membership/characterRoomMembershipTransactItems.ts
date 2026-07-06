import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { fromRoomMeta } from '../positionGraph'
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
                    draft.positionGraph = fromRoomMeta(draft, departureRoomId)
                        .removeCharacter(args.characterId)
                        .toStored()
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
                    draft.positionGraph = fromRoomMeta(draft, args.diff.to as EphemeraRoomId)
                        .addCharacter(args.characterId)
                        .toStored()
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

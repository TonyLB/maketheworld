import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { applyRoomStackToCharacterDraft, computeRoomStackUpdate } from './membershipRoomStack'
import type { RoomStackItem } from './types'

export type CharacterRoomStackTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const normalizeCurrentRoomStack = (stack: RoomStackItem[] | undefined): RoomStackItem[] =>
    stack ?? []

export const buildCharacterRoomStackTransactItems = (args: {
    characterId: EphemeraCharacterId
    targetRoomId: EphemeraRoomId
    characterAssets: string[]
    roomAssets: string[]
    canonAssets: string[]
    currentRoomStack: RoomStackItem[]
}): CharacterRoomStackTransactItem[] => [
    {
        Update: {
            Key: {
                EphemeraId: args.characterId,
                DataCategory: 'Meta::Character',
            },
            updateKeys: ['RoomStack'],
            updateReducer: (draft) => {
                const { destinationChain } = computeRoomStackUpdate({
                    targetRoomId: args.targetRoomId,
                    currentRoomStack: normalizeCurrentRoomStack(
                        draft.RoomStack as RoomStackItem[] | undefined
                    ),
                    characterAssets: args.characterAssets,
                    roomAssets: args.roomAssets,
                    canonAssets: args.canonAssets,
                })
                applyRoomStackToCharacterDraft(draft, {
                    targetRoomId: args.targetRoomId,
                    destinationChain,
                })
            },
        },
    },
]

import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { fromCharacterMeta } from '../../positionGraph'

export type CharacterInventoryDiff = {
    /** Prior character inventory hosts removed from. */
    froms: EphemeraCharacterId[];
    /** Target character inventory host; null = removed from all character hosts. */
    to: EphemeraCharacterId | null;
    changed: boolean;
}

export type CharacterInventoryTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

export const buildCharacterInventoryTransactItems = (args: {
    objectId: EphemeraObjectId;
    diff: CharacterInventoryDiff;
}): CharacterInventoryTransactItem[] => {
    const transactItems: CharacterInventoryTransactItem[] = []

    for (const departureCharacterId of args.diff.froms) {
        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: departureCharacterId,
                    DataCategory: 'Meta::Character',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    draft.positionGraph = fromCharacterMeta(draft, departureCharacterId)
                        .removeObject(args.objectId)
                        .toStored()
                },
            },
        })
        transactItems.push({
            Delete: {
                EphemeraId: args.objectId,
                DataCategory: buildPositionAdjacencyDataCategory(departureCharacterId),
            },
        })
    }

    if (args.diff.to) {
        transactItems.push({
            Update: {
                Key: {
                    EphemeraId: args.diff.to,
                    DataCategory: 'Meta::Character',
                },
                updateKeys: ['positionGraph'],
                updateReducer: (draft) => {
                    draft.positionGraph = fromCharacterMeta(draft, args.diff.to as EphemeraCharacterId)
                        .addObject(args.objectId)
                        .toStored()
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

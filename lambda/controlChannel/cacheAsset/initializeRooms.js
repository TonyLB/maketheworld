import { marshall } from "@aws-sdk/util-dynamodb"

import {
    ephemeraDB,
    batchWriteDispatcher
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { RoomKey } from '@tonylb/mtw-utilities/dist/types'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// initializeRooms (a) checks each Room ID to see whether
// it has already has a Meta::Room record defined for it, and (b) if there needs
// to be a new Meta::Room record, looks up the position of all CharactersInPlay,
// to populate the record correctly (even though the odds are that there are
// no matches between a totally uncached room and any CharacterInPlay ... pays
// to be careful!)
//
export const initializeRooms = async (roomIDs) => {
    const currentRoomItems = await ephemeraDB.batchGetItem(
            {
                Items: roomIDs.map((EphemeraId) => ({
                    EphemeraId,
                    DataCategory: 'Meta::Room'
                })),
                ProjectionFields: ['EphemeraId']
            }
        )
    const currentRoomIds = currentRoomItems.map(({ EphemeraId }) => (EphemeraId))
    const missingRoomIds = roomIDs.filter((roomId) => (!currentRoomIds.includes(roomId)))
    if (missingRoomIds.length > 0) {
        const charactersInPlay = await ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
            ExpressionAttributeNames: {
                "#name": "Name"
            },
            ProjectionFields: ['EphemeraId', 'RoomId', '#name', 'Connected', 'ConnectionId']
        })
        const newRoomsBase = missingRoomIds.reduce((previous, roomId) => ({
            ...previous,
            [roomId]: {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                activeCharacters: {},
                inactiveCharacters: {}
            }
        }), {})
        const insertInto = (state, target, label, { EphemeraId, ...rest }) => ({
            ...state,
            [target]: {
                ...state[target],
                [label]: {
                    ...state[target][label],
                    [EphemeraId]: {
                        EphemeraId,
                        ...rest
                    }
                }
            }
        })
        const newRoomsById = charactersInPlay.reduce((previous, { RoomId, EphemeraId, Name, Connected, ConnectionId }) => {
            const targetRoom = RoomKey(RoomId)
            if (previous[targetRoom]) {
                if (Connected) {
                    return insertInto(previous, targetRoom, 'activeCharacters', { EphemeraId, Name, ConnectionId })
                }
                else {
                    return insertInto(previous, targetRoom, 'inactiveCharacters', { EphemeraId, Name })
                }
            }
            else {
                return previous
            }
        }, newRoomsBase)
        await batchWriteDispatcher({
            table: ephemeraTable,
            items: Object.values(newRoomsById)
                .map((item) => ({
                    PutRequest: { Item: marshall(item) }
                }))
        })
    }
}

export const initializeFeatures = async (featureIDs) => {
    const currentFeatureItems = await ephemeraDB.batchGetItem(
            {
                Items: featureIDs.map((EphemeraId) => ({
                    EphemeraId,
                    DataCategory: 'Meta::Feature'
                })),
                ProjectionFields: ['EphemeraId']
            }
        )
    const currentFeatureIds = currentFeatureItems.map(({ EphemeraId }) => (EphemeraId))
    const missingFeatureIds = featureIDs.filter((featureId) => (!currentFeatureIds.includes(featureId)))
    if (missingFeatureIds.length > 0) {
        await batchWriteDispatcher({
            table: ephemeraTable,
            items: missingFeatureIds
                .map((featureId) => ({
                    PutRequest: { Item: marshall({
                        EphemeraId: featureId,
                        DataCategory: 'Meta::Feature'
                    }) }
                }))
        })
    }
}

export default initializeRooms

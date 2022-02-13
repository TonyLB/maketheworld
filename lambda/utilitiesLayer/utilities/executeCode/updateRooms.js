import { v4 as uuidv4 } from 'uuid'

import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
import { render } from '../perception/index.js'
import { splitType } from '../types.js'

export const updateRoomsByAsset = async (AssetId) => {
    const roomsToCheck = await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: `ASSET#${AssetId}`,
        KeyConditionExpression: 'begins_with(EphemeraId, :room)',
        ExpressionAttributeValues: {
            ':room': 'ROOM#'
        },
        ProjectionFields: ['EphemeraId']
    })
    const roomsMeta = await Promise.all(
        roomsToCheck.map(({ EphemeraId }) => (ephemeraDB.getItem({
            EphemeraId,
            DataCategory: 'Meta::Room',
            ProjectionFields: ['EphemeraId', 'activeCharacters']
        })))
    )
    const rendersToUpdate = roomsMeta
        .filter(({ activeCharacters }) => (Object.keys(activeCharacters).length > 0))
        .reduce((previous, { EphemeraId, activeCharacters }) => {
            return Object.keys(activeCharacters).reduce((accumulator, CharacterId) => ([ ...accumulator, { EphemeraId, CharacterId: splitType(CharacterId)[1] }]), previous)
        }, [])
    await Promise.all(rendersToUpdate.map(async ({ EphemeraId, CharacterId }) => {
        const renderOutput = await render({ EphemeraId, CharacterId })
        await publishMessage({
            MessageId: `MESSAGE#${uuidv4()}`,
            Targets: [`CHARACTER#${CharacterId}`],
            CreatedTime: Date.now(),
            DisplayProtocol: 'RoomUpdate',
            ...renderOutput
        })
    }))
}
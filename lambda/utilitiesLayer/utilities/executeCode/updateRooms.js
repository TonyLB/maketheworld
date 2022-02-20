import { v4 as uuidv4 } from 'uuid'

import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
import { render } from '../perception/index.js'
import { splitType } from '../types.js'

export const updateRooms = async (roomsToCheck) => {
    console.log(`RoomsToCheck: ${JSON.stringify(roomsToCheck, null, 4)}`)
    const roomsMeta = await Promise.all(
        roomsToCheck.map((roomId) => (ephemeraDB.getItem({
            EphemeraId: `ROOM#${roomId}`,
            DataCategory: 'Meta::Room',
            ProjectionFields: ['EphemeraId', 'activeCharacters']
        })))
    )
    const rendersToUpdate = roomsMeta
        .filter(({ activeCharacters }) => (Object.keys(activeCharacters).length > 0))
        .reduce((previous, { EphemeraId, activeCharacters }) => {
            return Object.keys(activeCharacters).reduce((accumulator, CharacterId) => ([ ...accumulator, { EphemeraId, CharacterId: splitType(CharacterId)[1] }]), previous)
        }, [])
    const renderOutput = await render(rendersToUpdate)
    await Promise.all(renderOutput.map(({ EphemeraId, CharacterId, ...roomMessage }) => (
        publishMessage({
            MessageId: `MESSAGE#${uuidv4()}`,
            Targets: [`CHARACTER#${CharacterId}`],
            CreatedTime: Date.now(),
            DisplayProtocol: 'RoomUpdate',
            ...roomMessage
        })
    )))
}
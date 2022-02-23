import { v4 as uuidv4 } from 'uuid'

import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
import { render } from '../perception/index.js'
import { splitType } from '../types.js'

export const updateRooms = async (roomsToCheck, existingStatesByAsset = {}, recalculated = []) => {
    const roomsMeta = await Promise.all(
        roomsToCheck.map((roomId) => (ephemeraDB.getItem({
            EphemeraId: `ROOM#${roomId}`,
            DataCategory: 'Meta::Room',
            ProjectionFields: ['EphemeraId', 'activeCharacters']
        })))
    )
    //
    // TODO: Hoist fetching of globalAssets and personalAssets from render to here (with a missing-check left
    // in render to take up the slack) and use recalculated, plus the dependencies in existingStatesByAsset,
    // plus the fetched asset assignments to judge which characters have assets whose render could
    // have been changed by the property changes we've encountered, then pass the fetched Asset lists to
    // render to prime the pump
    //
    const rendersToUpdate = roomsMeta
        .filter(({ activeCharacters }) => (Object.keys(activeCharacters).length > 0))
        .reduce((previous, { EphemeraId, activeCharacters }) => {
            return Object.keys(activeCharacters).reduce((accumulator, CharacterId) => ([ ...accumulator, { EphemeraId, CharacterId: splitType(CharacterId)[1] }]), previous)
        }, [])
    const renderOutput = await render(rendersToUpdate, existingStatesByAsset)
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
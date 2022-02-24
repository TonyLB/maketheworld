import { v4 as uuidv4 } from 'uuid'

import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
import { render } from '../perception/index.js'
import { getGlobalAssets, getCharacterAssets } from '../perception/dynamoDB.js'
import { splitType } from '../types.js'

export const updateRooms = async ({
    assetsByRoom,
    existingStatesByAsset = {},
    recalculated = []
}) => {
    const roomsMetaFetch = await Promise.all(
        Object.keys(assetsByRoom).map((roomId) => (ephemeraDB.getItem({
            EphemeraId: `ROOM#${roomId}`,
            DataCategory: 'Meta::Room',
            ProjectionFields: ['EphemeraId', 'activeCharacters']
        })))
    )
    if (roomsMetaFetch.length === 0) {
        return []
    }
    const roomsMeta = roomsMetaFetch.map(({ EphemeraId, activeCharacters }) => ({
        EphemeraId,
        activeCharacters,
        assets: assetsByRoom[splitType(EphemeraId)[1]] || []
    }))

    const allCharacters = [...(new Set(roomsMeta.reduce((previous, { activeCharacters }) => ([...previous, Object.keys(activeCharacters).map((value) => (splitType(value)[1]))]), [])))]
    const [globalAssets, characterAssets] = await Promise.all([
        getGlobalAssets(),
        getCharacterAssets(allCharacters)
    ])
    const characterSeesChange = (characterId, changedAssets) => {
        const localAssets = characterAssets[characterId] || []
        return Boolean([...globalAssets, ...localAssets].find((asset) => (changedAssets.includes(asset))))
    }
    const rendersToUpdate = roomsMeta
        .filter((value) => ('activeCharacters' in value))
        .reduce((previous, { EphemeraId, activeCharacters, assets }) => {
            return Object.keys(activeCharacters)
                .map((CharacterId) => (splitType(CharacterId)[1]))
                .filter((characterId) => (characterSeesChange(characterId, assets)))
                .reduce((accumulator, characterId) => ([ ...accumulator, { EphemeraId, CharacterId: characterId }]), previous)
        }, [])
    const renderOutput = await render({
        renderList: rendersToUpdate,
        assetMeta: existingStatesByAsset,
        assetLists: {
            global: globalAssets,
            characters: characterAssets
        }
    })
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
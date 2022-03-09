import { v4 as uuidv4 } from 'uuid'

import { ephemeraDB, publishMessage } from '../dynamoDB/index.js'
import { render } from '../perception/index.js'
import { deliverRenders } from '../perception/deliverRenders.js'
import { getGlobalAssets, getCharacterAssets } from '../perception/dynamoDB.js'
import { splitType, RoomKey } from '../types.js'
import { unique } from '../lists.js'

//
// Assumption:  roomsWithMapUpdates should be a subset of Object.keys(assetsChangedByRoom)
// (which is to say, any room updated in such a way as to side-effect maps should also
// be included in the updates to room description)
//
export const updateRooms = async ({
    assetsChangedByRoom,
    assetsChangedByMap = {},
    roomsWithMapUpdates = [],
    existingStatesByAsset = {}
}) => {
    const roomsMetaFetch = await Promise.all(
        Object.keys(assetsChangedByRoom).map((roomId) => (ephemeraDB.getItem({
            EphemeraId: RoomKey(roomId),
            DataCategory: 'Meta::Room',
            ProjectionFields: ['EphemeraId', 'activeCharacters', 'Dependencies']
        })))
    )
    if (roomsMetaFetch.length === 0) {
        return []
    }
    const roomsMeta = roomsMetaFetch.map(({ EphemeraId, activeCharacters, Dependencies = {} }) => ({
        EphemeraId,
        activeCharacters,
        Dependencies,
        assets: assetsChangedByRoom[splitType(EphemeraId)[1]] || []
    }))

    //
    // Look at all the maps that might be side-effected by the room changes we're
    // updating.  Check against all currently active characters, and update for
    // those who have visibility on an Asset in which that map is defined
    //
    const mapsToCheck = [...(new Set(roomsMeta
        .filter(({ EphemeraId }) => (roomsWithMapUpdates.includes(splitType(EphemeraId)[1])))
        .map(({ Dependencies: { map = [] } = {} }) => (map))
        .reduce((previous, map) => ([ ...previous, ...map ]), [])))]
    const fetchAssetsByMap = async () => {
        const assetFetchByMap = async (mapId) => {
            const dcQueryItems = await ephemeraDB.query({
                EphemeraId: mapId,
                KeyConditionExpression: 'begins_with(DataCategory, :assets)',
                ExpressionAttributeValues: {
                    ':assets': 'ASSET#'
                },
                ProjectionFields: ['DataCategory']
            })
            const assetList = dcQueryItems
                .map(({ DataCategory = '' }) => (splitType(DataCategory)[1]))
                .filter((value) => (value))
            return {
                [mapId]: assetList
            }
        }
        const assetFetches = await Promise.all(mapsToCheck.map(assetFetchByMap))
        return Object.assign({}, ...assetFetches)
    }
    const fetchAllActiveCharacters = async () => {
        const characterQueryItems = await ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['EphemeraId', 'Connected']
        })
        return characterQueryItems
            .filter(({ Connected }) => (Connected))
            .map(({ EphemeraId }) => (splitType(EphemeraId)[1]))
    }

    const referencedCharacters = unique(...roomsMeta.map(({ activeCharacters }) => (Object.keys(activeCharacters).map((value) => (splitType(value)[1])))))
    const [globalAssets, fetchedAssetsByMap = {}, fetchAllCharacters = []] = await Promise.all([
        getGlobalAssets(),
        ...(((mapsToCheck.length > 0) || (Object.keys(assetsChangedByMap).length > 0))
            ? [
                fetchAssetsByMap(),
                fetchAllActiveCharacters()
            ]
            :[]
        )
    ])
    const allCharacters = unique(referencedCharacters, fetchAllCharacters)
    const characterAssets = await getCharacterAssets(allCharacters)
    //
    // Combine the assets-per-map from mapCache side-effects with the assets-per-map sent from
    // direct map changes detected in calculating dependency updates
    //
    const assetsByMap = Object.entries(fetchedAssetsByMap)
        .reduce((previous, [mapId, assets]) => ({
            ...previous,
            [mapId]: [...(new Set([
                ...(previous[mapId] || []),
                ...assets
            ]))]
        }), assetsChangedByMap)
    const characterSeesChange = (characterId, changedAssets) => {
        const localAssets = characterAssets[characterId] || []
        return Boolean([...globalAssets, ...localAssets].find((asset) => (changedAssets.includes(asset))))
    }
    const roomsToUpdate = roomsMeta
        .filter((value) => ('activeCharacters' in value))
        .reduce((previous, { EphemeraId, activeCharacters, assets }) => {
            return Object.keys(activeCharacters)
                .map((CharacterId) => (splitType(CharacterId)[1]))
                .filter((characterId) => (characterSeesChange(characterId, assets)))
                .reduce((accumulator, characterId) => ([ ...accumulator, { EphemeraId, CharacterId: characterId }]), previous)
        }, [])
    const mapDirectUpdates = Object.keys(assetsChangedByMap)
        .reduce((previous, mapId) => {
            const charactersWhoSeeUpdate = allCharacters
                .filter((characterId) => (characterSeesChange(characterId, assetsChangedByMap[mapId] || [])))
            return [
                ...previous,
                ...(charactersWhoSeeUpdate
                    .map((CharacterId) => ({
                        EphemeraId: `MAP#${mapId}`,
                        CharacterId
                    }))
                )
            ]                
        }, [])
    const mapRoomUpdates = mapsToCheck
        .reduce((previous, mapId) => {
            const charactersWhoSeeMap = allCharacters
                .filter((characterId) => (characterSeesChange(characterId, assetsByMap[mapId] || [])))
            return [
                ...previous,
                ...(charactersWhoSeeMap
                    .map((CharacterId) => ({
                        EphemeraId: mapId,
                        CharacterId
                    }))
                )
            ]
        }, mapDirectUpdates)
    const deduplicate = (firstList, secondList) => {
        const deduplicatedMapUpdates = secondList
            .filter(({ EphemeraId: mapEphemeraId, CharacterId: mapCharacterId }) => (
                !(firstList.find(({ EphemeraId, CharacterId }) => (EphemeraId === mapEphemeraId && CharacterId === mapCharacterId)))
            ))
        return [...firstList, ...deduplicatedMapUpdates]
    }
    const renderOutputs = await render({
        renderList: deduplicate(roomsToUpdate, mapRoomUpdates),
        assetMeta: existingStatesByAsset,
        assetLists: {
            global: globalAssets,
            characters: characterAssets
        }
    })
    await deliverRenders({
        renderOutputs
    })
}
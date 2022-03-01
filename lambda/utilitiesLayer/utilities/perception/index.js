import { memoizedEvaluate, clearMemoSpace } from './memoize.js'
import { splitType, AssetKey } from '../types.js'

import { getCharacterAssets, getRoomMeta, getStateByAsset, getGlobalAssets } from './dynamoDB.js'

const evaluateConditionalList = (asset, list = [], state) => {
    if (list.length > 0) {
        const [first, ...rest] = list
        const evaluation = memoizedEvaluate(asset, first.if, state)

        if (Boolean(evaluation) && evaluation !== '{#ERROR}') {
            return evaluateConditionalList(rest)
        }
        else {
            return false
        }
    }
    return true
}

export const renderItems = async (renderList, existingStatesByAsset = {}, priorAssetLists = {}) => {
    const roomsToRender = [...(new Set(renderList.map(({ EphemeraId }) => (EphemeraId))))]
    const charactersToRenderFor = [...(new Set(renderList.map(({ CharacterId }) => (CharacterId))))]

    const [
        globalAssets = [],
        roomMetaData = {},
        characterAssets = {}
    ] = await Promise.all([
        getGlobalAssets(priorAssetLists.global),
        getRoomMeta(roomsToRender),
        getCharacterAssets(charactersToRenderFor, priorAssetLists.characters)
    ])
    
    //
    // Parse through the room/character combinations, and deduce the asset states that will be
    // needed during the course of rendering them all, less the ones we were already passed
    // in existingStatesByAsset
    //
    const allAssets = renderList.reduce((previous, { EphemeraId, CharacterId }) => ([
            ...previous,
            ...(roomMetaData[EphemeraId]
                .map(({ DataCategory }) => (splitType(DataCategory)[1]))
                .filter((value) => ([...globalAssets, ...(characterAssets[CharacterId])].includes(value)))
            )
        ]), [])
        .filter((asset) => (!(asset in existingStatesByAsset)))
    const deduplicatedAssetList = [...(new Set(allAssets))]
    const fetchedAssetStateById = await getStateByAsset(deduplicatedAssetList)
    const assetStateById = { ...existingStatesByAsset, ...fetchedAssetStateById }

    clearMemoSpace()

    return renderList.map(({ EphemeraId, CharacterId }) => {
        const [objectType] = splitType(EphemeraId)
        switch(objectType) {
            case 'ROOM':
                const RoomId = splitType(EphemeraId)[1]
                const personalAssets = characterAssets[CharacterId] || []
                const RoomItems = roomMetaData[EphemeraId] || []
                const RoomMeta = RoomItems.find(({ DataCategory }) => (DataCategory === 'Meta::Room'))
                const RoomMetaByAsset = RoomItems
                    .reduce((previous, { DataCategory, ...rest }) => {
                        if (DataCategory === 'Meta::Room') {
                            return previous
                        }
                        return {
                            ...previous,
                            [DataCategory]: rest
                        }
                    }, {})
                const assetsToRender = [
                        ...globalAssets,
                        ...(personalAssets.filter((value) => (!globalAssets.includes(value))))
                    ].map(AssetKey)
                    .filter((AssetId) => (RoomMetaByAsset[AssetId]))
                const { render, name, exits } = assetsToRender.reduce((previous, AssetId) => {
                        const { appearances = [] } = RoomMetaByAsset[AssetId]
                        const state = assetStateById[splitType(AssetId)[1]] || {}
                        return appearances
                            .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                            .reduce(({ render: previousRender, name: previousName, exits: previousExits }, { render, name, exits }) => ({
                                render: [ ...previousRender, ...(render || []) ],
                                name: [ ...previousName, ...(name || []) ],
                                exits: [ ...previousExits, ...(exits || []) ],
                            }), previous)
                    }, { render: [], name: [], exits: [] })
                    //
                    // TODO: Evaluate expressions before inserting them
                    //
                return {
                    EphemeraId,
                    CharacterId,
                    render,
                    name: name.join(''),
                    exits,
                    characters: Object.values((RoomMeta ?? {}).activeCharacters || {})
                }

            default:
                return {
                    EphemeraId,
                    CharacterId
                }
        }
    })
}

//
// TODO: Import recalculated into render, and use it to only include characters who have
// asset/room combinations that are changed by the recalculated values
//
export const render = async ({
    renderList = [],
    assetMeta = {},
    assetLists = {}
}) => {
    const renderedOutput = await renderItems(renderList, assetMeta, assetLists)
    return renderedOutput.map(({ EphemeraId, CharacterId, ...rest }) => {
        const [objectType, objectKey] = splitType(EphemeraId)
        switch(objectType) {
            case 'ROOM':
                const { render: Description, name: Name, exits, characters } = rest
                const Message = {
                    EphemeraId,
                    CharacterId,
                    RoomId: objectKey,
                    //
                    // TODO:  Replace Ancestry with a new map system
                    //
                    Ancestry: '',
                    Characters: characters.map(({ EphemeraId, ConnectionId, ...rest }) => ({ CharacterId: splitType(EphemeraId)[1], ...rest })),
                    Description,
                    Name,
                    Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' }))
                }
                return Message
            default:
                return {
                    EphemeraId,
                    CharacterId,
                }
        }
    })
}

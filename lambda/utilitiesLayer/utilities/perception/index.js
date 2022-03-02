import { memoizedEvaluate, clearMemoSpace } from './memoize.js'
import { splitType, AssetKey } from '../types.js'

import { getCharacterAssets, getItemMeta, getStateByAsset, getGlobalAssets } from './dynamoDB.js'

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
    const itemsToRender = [...(new Set(renderList.map(({ EphemeraId }) => (EphemeraId))))]
    const charactersToRenderFor = [...(new Set(renderList.map(({ CharacterId }) => (CharacterId))))]

    const [
        globalAssets = [],
        itemMetaData = {},
        characterAssets = {}
    ] = await Promise.all([
        getGlobalAssets(priorAssetLists.global),
        getItemMeta(itemsToRender),
        getCharacterAssets(charactersToRenderFor, priorAssetLists.characters)
    ])
    
    //
    // Parse through the room/character combinations, and deduce the asset states that will be
    // needed during the course of rendering them all, less the ones we were already passed
    // in existingStatesByAsset
    //
    const allAssets = renderList.reduce((previous, { EphemeraId, CharacterId }) => ([
            ...previous,
            ...(itemMetaData[EphemeraId]
                .map(({ DataCategory }) => (splitType(DataCategory)[1]))
                .filter((value) => ([...globalAssets, ...(characterAssets[CharacterId])].includes(value)))
            )
        ]), [])
        .filter((asset) => (!(asset in existingStatesByAsset)))
    const deduplicatedAssetList = [...(new Set(allAssets))]
    const fetchedAssetStateById = await getStateByAsset(deduplicatedAssetList)
    const assetStateById = { ...existingStatesByAsset, ...fetchedAssetStateById }

    clearMemoSpace()

    const extractRenderArguments = ({ EphemeraId, CharacterId }) => {
        const personalAssets = characterAssets[CharacterId] || []
        const items = itemMetaData[EphemeraId] || []
        const meta = items.find(({ DataCategory }) => (DataCategory.startsWith('Meta::')))
        const itemsByAsset = items
            .reduce((previous, { DataCategory, ...rest }) => {
                if (DataCategory.startsWith('Meta::')) {
                    return previous
                }
                return {
                    ...previous,
                    [DataCategory]: rest
                }
            }, {})
        const assets = [
                ...globalAssets,
                ...(personalAssets.filter((value) => (!globalAssets.includes(value))))
            ].map(AssetKey)
            .filter((AssetId) => (itemsByAsset[AssetId]))

        return { assets, meta, itemsByAsset }

    }

    return renderList.map(({ EphemeraId, CharacterId }) => {
        const [objectType] = splitType(EphemeraId)
        const { assets, meta, itemsByAsset } = extractRenderArguments({ EphemeraId, CharacterId })
        switch(objectType) {
            case 'ROOM':
                const { render: roomRender, name: roomName, exits: roomExits, features: roomFeatures } = assets.reduce((previous, AssetId) => {
                        const { appearances = [] } = itemsByAsset[AssetId]
                        const state = assetStateById[splitType(AssetId)[1]] || {}
                        return appearances
                            .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                            .reduce(({ render: previousRender, name: previousName, exits: previousExits, features: previousFeatures }, { render, name, exits, features }) => ({
                                render: [ ...previousRender, ...(render || []) ],
                                name: [ ...previousName, ...(name || []) ],
                                exits: [ ...previousExits, ...(exits || []) ],
                                features: [ ...previousFeatures, ...(features || []) ]
                            }), previous)
                    }, { render: [], name: [], exits: [], features: [] })
                    //
                    // TODO: Evaluate expressions before inserting them
                    //
                return {
                    EphemeraId,
                    CharacterId,
                    render: roomRender,
                    name: roomName.join(''),
                    exits: roomExits,
                    features: roomFeatures,
                    characters: Object.values((meta ?? {}).activeCharacters || {})
                }

            case 'FEATURE':
                const { render: featureRender, name: featureName, features: featureFeatures } = assets.reduce((previous, AssetId) => {
                        const { appearances = [], name } = itemsByAsset[AssetId]
                        const state = assetStateById[splitType(AssetId)[1]] || {}
                        return appearances
                            .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                            .reduce(({ render: previousRender, features: previousFeatures, name: previousName }, { render, features }) => ({
                                render: [ ...previousRender, ...(render || []) ],
                                features: [ ...previousFeatures, ...(features || []) ],
                                name: previousName
                            }), { ...previous, name: [ ...previous.name, name ] })
                    }, { render: [], name: [], features: [] })
                    //
                    // TODO: Evaluate expressions before inserting them
                    //
                return {
                    EphemeraId,
                    CharacterId,
                    render: featureRender,
                    name: featureName.join(''),
                    features: featureFeatures
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
        const { render: Description, name: Name, exits, characters, features } = rest
        switch(objectType) {
            case 'ROOM':
                const RoomMessage = {
                    tag: 'Room',
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
                    Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' })),
                    Features: features
                }
                return RoomMessage
            case 'FEATURE':
                const FeatureMessage = {
                    tag: 'Feature',
                    EphemeraId,
                    CharacterId,
                    FeatureId: objectKey,
                    Description,
                    Name,
                    Features: features
                }
                return FeatureMessage
            default:
                return {
                    EphemeraId,
                    CharacterId,
                }
        }
    })
}

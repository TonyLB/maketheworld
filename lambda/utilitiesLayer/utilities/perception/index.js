import { memoizedEvaluate, clearMemoSpace } from './memoize.js'
import { splitType, AssetKey, RoomKey } from '../types.js'

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
    const allAssets = renderList.reduce((previous, { EphemeraId, CharacterId }) => {
        //
        // Map items need to evaluate the mapCache from every accessible asset (even ones
        // that the Map isn't present in)...
        //
        if (splitType(EphemeraId)[0] === 'MAP') {
            return [...previous, ...globalAssets, ...(characterAssets[CharacterId])]
        }
        //
        // Whereas Room and Feature items only need the State information from the
        // specific assets they have appearances in
        //
        return [
            ...previous,
            ...(itemMetaData[EphemeraId]
                .map(({ DataCategory }) => (splitType(DataCategory)[1]))
                .filter((value) => ([...globalAssets, ...(characterAssets[CharacterId])].includes(value)))
            )
        ]
    }, [])
    const deduplicatedAssetList = [...(new Set(allAssets))]
    const assetStateById = await getStateByAsset(deduplicatedAssetList, existingStatesByAsset)

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

    return renderList.map(({ EphemeraId, CharacterId, mapValuesOnly = false }) => {
        const mapRenderFormats = (renderItem) => {
            if (renderItem?.tag === 'String') {
                return renderItem.value
            }
            return renderItem
        }
        const [objectType] = splitType(EphemeraId)
        const { assets, meta, itemsByAsset } = extractRenderArguments({ EphemeraId, CharacterId })
        switch(objectType) {
            case 'CHARACTERINPLAY':
                return {
                    Targets: [`CHARACTER#${CharacterId}`],
                    EphemeraId,
                    CharacterId: splitType(EphemeraId)[1],
                    Name: meta.Name,
                    fileURL: meta.fileURL
                }
            case 'ROOM':
                const { render: roomRender, name: roomName, exits: roomExits, features: roomFeatures } = assets.reduce((previous, AssetId) => {
                        const { appearances = [] } = itemsByAsset[AssetId]
                        const state = assetStateById[splitType(AssetId)[1]]?.State || {}
                        return appearances
                            .filter(({ name, exits }) => (!mapValuesOnly || ((name || []).length > 0 || (exits || []).length > 0)))
                            .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                            .reduce(({ render: previousRender, name: previousName, exits: previousExits, features: previousFeatures }, { render, name, exits, features }) => ({
                                name: [ ...previousName, ...(name || []) ],
                                exits: [ ...previousExits, ...(exits || []) ],
                                ...(mapValuesOnly
                                    ? {}
                                    : {
                                        render: [ ...previousRender, ...(render || []).map(mapRenderFormats) ],
                                        features: [ ...previousFeatures, ...(features || []) ]
                                    }
                                )
                            }), previous)
                    }, { render: [], name: [], exits: [], features: [] })
                    //
                    // TODO: Evaluate expressions before inserting them
                    //
                return {
                    EphemeraId,
                    CharacterId,
                    mapValuesOnly,
                    render: roomRender,
                    name: roomName.join(''),
                    exits: roomExits,
                    features: roomFeatures,
                    characters: Object.values((meta ?? {}).activeCharacters || {})
                }

            case 'FEATURE':
                const { render: featureRender, name: featureName, features: featureFeatures } = assets.reduce((previous, AssetId) => {
                        const { appearances = [], name } = itemsByAsset[AssetId]
                        const state = assetStateById[splitType(AssetId)[1]]?.State || {}
                        return appearances
                            .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                            .reduce(({ render: previousRender, features: previousFeatures, name: previousName }, { render, features }) => ({
                                render: [ ...previousRender, ...(render || []).map(mapRenderFormats) ],
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

            case 'MAP':
                const roomPseudonym = (AssetId, roomId) => (`${splitType(AssetId)[1]}#${roomId}`)
                const assetsOfInterest = [...(new Set([...globalAssets, ...characterAssets[CharacterId]]))]
                const aggregatedMapCacheByEphemeraId = assetsOfInterest
                    .reduce((previous, assetId) => (Object.values(assetStateById[assetId]?.mapCache || {})
                        .reduce((accumulator, { EphemeraId, name = [], exits = [] }) => ({
                            ...accumulator,
                            [EphemeraId]: {
                                ...(accumulator[EphemeraId] || {}),
                                name: [
                                    ...(accumulator[EphemeraId]?.name || []),
                                    ...name
                                ],
                                exits: [
                                    ...(accumulator[EphemeraId]?.exits || []),
                                    ...(exits.map(({ name, toEphemeraId }) => ({ name, toEphemeraId })))
                                ]
                            }
                        }), previous)
                    ), {})

                const { visibleMapAppearancesByAsset, name: mapName = [] } = assets.reduce((previous, AssetId) => {
                    const { appearances = [], name } = itemsByAsset[AssetId]

                    const { State: state = {} } = assetStateById[splitType(AssetId)[1]] || {}
                    return {
                        visibleMapAppearancesByAsset: {
                            ...previous.visibleMapAppearancesByAsset,
                            [AssetId]: appearances
                                .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                        },
                        name: [ ...previous.name, name ].filter((value) => (value))
                    }
                }, { visibleMapAppearancesByAsset: {}, name: [] })
    
                const roomKeysByEphemera = assets.reduce((previous, AssetId) => {
                    const appearances = visibleMapAppearancesByAsset[AssetId] || []
                    const roomEntriesInOrder = appearances.reduce((accumulator, { rooms }) => ([
                        ...accumulator,
                        ...(Object.entries(rooms))
                    ]), [])

                    const roomKeysByEphemera = roomEntriesInOrder
                        .reduce((accumulator, [roomId, { EphemeraId }]) => ({
                            ...accumulator,
                            [EphemeraId]: roomPseudonym(AssetId, roomId)
                        }), previous)

                    return roomKeysByEphemera
                }, {})

                const mapRooms = assets.reduce((previous, AssetId) => {
                    const appearances = visibleMapAppearancesByAsset[AssetId] || []
                    const roomEntriesInOrder = appearances.reduce((accumulator, { rooms }) => ([
                        ...accumulator,
                        ...(Object.entries(rooms))
                    ]), [])

                    //
                    // TODO: Instead of merging all room updates beyond separation, sort into
                    // sequential layers, labelled with the AssetId in which the appearances occurred,
                    // and ordered in the sortImportMap sequence.
                    //
                    const mapRooms = roomEntriesInOrder
                        .reduce((accumulator, [roomId, { EphemeraId, ...rest }]) => {
                            const { exits, ...remainingAggregate } = aggregatedMapCacheByEphemeraId[EphemeraId] || {}
                            const mappedExits = (exits !== undefined)
                                ? exits
                                    .filter(({ toEphemeraId }) => (roomKeysByEphemera[RoomKey(toEphemeraId)]))
                                    .map(({ name, toEphemeraId }) => ({
                                        name,
                                        to: roomKeysByEphemera[RoomKey(toEphemeraId)]
                                    }))
                                : undefined
                            return {
                                ...accumulator,
                                [roomPseudonym(AssetId, roomId)]: {
                                    ...remainingAggregate,
                                    ...rest,
                                    exits: mappedExits,
                                    EphemeraId
                                }
                            }
                        }, previous)
                    return mapRooms
                }, {})

                const fileURL = assets.reduce((previous, AssetId) => {
                    const appearances = visibleMapAppearancesByAsset[AssetId] || []
                    return appearances.reduce((accumulator, { fileURL }) => (fileURL || accumulator), previous)
                }, undefined)

                return {
                    EphemeraId,
                    CharacterId,
                    fileURL,
                    name: mapName.join(''),
                    rooms: mapRooms
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
    return renderedOutput.map(({ EphemeraId, CharacterId, mapValuesOnly, ...rest }) => {
        const [objectType, objectKey] = splitType(EphemeraId)
        const { render: Description, name: Name, exits, characters, features, rooms, fileURL, Targets } = rest
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
                    Name,
                    Exits: exits.map(({ to, name }) => ({ RoomId: to, Name: name, Visibility: 'Public' })),
                    ...(
                        mapValuesOnly
                            ? {}
                            : {
                                Characters: characters.map(({ EphemeraId, ConnectionId, ...rest }) => ({ CharacterId: splitType(EphemeraId)[1], ...rest })),
                                Description,
                                Features: features
                            }
                    )
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
            case 'MAP':
                const MapMessage = {
                    type: 'Map',
                    EphemeraId,
                    CharacterId,
                    MapId: objectKey,
                    Name,
                    fileURL,
                    rooms
                }
                return MapMessage
            case 'CHARACTERINPLAY':
                const CharacterMessage = {
                    tag: 'Character',
                    EphemeraId,
                    Targets,
                    CharacterId,
                    Name: rest.Name,
                    fileURL
                }
                return CharacterMessage
            default:
                return {
                    EphemeraId,
                    CharacterId,
                }
        }
    })
}

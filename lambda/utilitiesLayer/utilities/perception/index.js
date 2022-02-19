import { memoizedEvaluate, clearMemoSpace } from './memoize.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { splitType } from '../types.js'

const evaluateConditionalList = (asset, list = [], state) => {
    if (list.length > 0) {
        const [first, ...rest] = list
        const evaluation = memoizedEvaluate(asset, first, state)

        if (Boolean(evaluation) && evaluation !== '{#ERROR}') {
            return evaluateConditionalList(rest)
        }
        else {
            return false
        }
    }
    return true
}

const getRoomMeta = async (rooms) => {
    const getSingleRoomMeta = async (EphemeraId) => {
        const roomItems = await ephemeraDB.query({
            EphemeraId,
            ProjectionFields: ['DataCategory', 'appearances'],
        })
        return { [EphemeraId]: roomItems }
    }
    const allRooms = await Promise.all(rooms.map(getSingleRoomMeta))
    return Object.assign({}, ...allRooms)
}

const getCharacterAssets = async (characters) => {
    const getSingleCharacterAssets = async (characterId) => {
        const { assets = [] } = await ephemeraDB.getItem({
            EphemeraId: `CHARACTERINPLAY#${characterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['assets']
        })
        return { [characterId]: assets }
    }
    const allCharacters = await Promise.all(characters.map(getSingleCharacterAssets))
    return Object.assign({}, ...allCharacters)
}

const getStateByAsset = async (assets) => {
    const getSingleState = async (assetId) => {
        const { State = {} } = await ephemeraDB.getItem({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        })
        return { [assetId]: Object.entries(State).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {}) }
    }
    const allStates = await Promise.all(assets.map(getSingleState))
    return Object.assign({}, ...allStates)
}

export const renderItems = async (renderList) => {
    const roomsToRender = [...(new Set(renderList.map(({ EphemeraId }) => (EphemeraId))))]
    const charactersToRenderFor = [...(new Set(renderList.map(({ CharacterId }) => (CharacterId))))]

    const [
        { assets: globalAssets = [] } = {},
        roomMetaData = {},
        characterAssets = {}
    ] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: 'Global',
            DataCategory: 'Assets',
            ProjectionFields: ['assets']
        }),
        getRoomMeta(roomsToRender),
        getCharacterAssets(charactersToRenderFor)
    ])
    const allAssets = [...(new Set([
        ...globalAssets,
        ...(Object.values(characterAssets).reduce((previous, list) => ([ ...previous, ...list ]), []))
    ]))]
    const assetStateById = await getStateByAsset(allAssets)

    clearMemoSpace()

    return renderList.map(({ EphemeraId, CharacterId }) => {
        const [objectType] = splitType(EphemeraId)
        switch(objectType) {
            case 'ROOM':
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
                    ].map((key) => (`ASSET#${key}`))
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
                        // return {
                        //     ...previous,
                        //     render: render
                        //         .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                        //         .reduce((accumulate, { render }) => ([...accumulate, ...render]), previous.render),
                        //     name: name
                        //         .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                        //         .reduce((accumulate, { name }) => ([...accumulate, ...name]), previous.name),
                        //     exits: exits
                        //         .filter(({ conditions }) => (evaluateConditionalList(AssetId, conditions, state)))
                        //         .reduce((accumulate, { exits }) => ([...accumulate, ...exits.map(({ to, ...rest }) => ({ to: splitType(to)[1], ...rest }))]), previous.exits),
                        // }
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

export const render = async (renderList) => {
    const renderedOutput = await renderItems(renderList)
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


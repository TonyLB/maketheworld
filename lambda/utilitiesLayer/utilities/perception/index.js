import evaluateCode from './compileCode.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { splitType } from '../types.js'

let memoSpace = {}
const clearMemoSpace = () => {
    memoSpace = {}
}
const memoizedEvaluate = (expression, state) => {
    if (memoSpace[expression]) {
        return expression
    }
    //
    // TODO: Create sandbox serialization in Ephemera, and use it to populate
    // the sandbox for evaluating code
    //

    //
    // TODO: Create set operators for the sandbox that throw an error when
    // attempting to set global variables during a pure evaluation
    //
    try {
        const outcome = evaluateCode(`return (${expression})`)(state)
        memoSpace[expression] = outcome
        return outcome
    }
    catch(e) {
        const outcome = '{#ERROR}'
        memoSpace[expression] = outcome
        return outcome
    }
}

const evaluateConditionalList = (list = [], state) => {
    if (list.length > 0) {
        const [first, ...rest] = list
        const evaluation = memoizedEvaluate(first, state)

        if (Boolean(evaluation) && evaluation !== '{#ERROR}') {
            return evaluateConditionalList(rest)
        }
        else {
            return false
        }
    }
    return true
}

export const renderItem = async ({ CharacterId, EphemeraId }) => {
    const [objectType] = splitType(EphemeraId)
    switch(objectType) {
        case 'ROOM':
            const [
                    RoomItems = [],
                    globalAssetItem = {},
                    personalAssetItem = {},
            ] = await Promise.all([
                ephemeraDB.query({
                    EphemeraId,
                    ProjectionFields: ['DataCategory', 'render', '#name', 'exits'],
                    ExpressionAttributeNames: {
                        '#name': 'name'
                    }
                }),
                ephemeraDB.getItem({
                    EphemeraId: 'Global',
                    DataCategory: 'Assets',
                    ProjectionFields: ['assets']
                }),
                ephemeraDB.getItem({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['assets']
                })
            ])
            const { assets: globalAssets = [] } = globalAssetItem
            const { assets: personalAssets = [] } = personalAssetItem
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
            const assetStateItems = await Promise.all(
                assetsToRender.map((AssetId) => (
                    ephemeraDB.getItem({
                        EphemeraId: AssetId,
                        DataCategory: 'Meta::Asset',
                        ProjectionFields: ['EphemeraId', '#state'],
                        ExpressionAttributeNames: {
                            '#state': 'State'
                        }
                    })
                ))
            )
            console.log(`AssetStateItems: ${JSON.stringify(assetStateItems, null, 4)}`)
            const assetStateById = assetStateItems.reduce((previous, { EphemeraId, State = {} }) => ({ ...previous, [EphemeraId]: State }), {})
            const { render, name, exits } = assetsToRender.reduce((previous, AssetId) => {
                    const { render = [], name = [], exits = [] } = RoomMetaByAsset[AssetId]
                    const state = assetStateById[AssetId] || {}
                    clearMemoSpace()
                    return {
                        ...previous,
                        render: render
                            .filter(({ conditions }) => (evaluateConditionalList(conditions, state)))
                            .reduce((accumulate, { render }) => ([...accumulate, ...render]), previous.render),
                        name: name
                            .filter(({ conditions }) => (evaluateConditionalList(conditions, state)))
                            .reduce((accumulate, { name }) => ([...accumulate, ...name]), previous.name),
                        exits: exits
                            .filter(({ conditions }) => (evaluateConditionalList(conditions, state)))
                            .reduce((accumulate, { exits }) => ([...accumulate, ...exits.map(({ to, ...rest }) => ({ to: splitType(to)[1], ...rest }))]), previous.exits),
                    }
                }, { render: [], name: [], exits: [] })
                //
                // TODO: Evaluate expressions before inserting them
                //
            return {
                render: render.join(''),
                name: name.join(''),
                exits,
                characters: Object.values((RoomMeta ?? {}).activeCharacters || {})
            }

        default:
            return null
    }
}

export const render = async ({ CharacterId, EphemeraId }) => {
    const [objectType, objectKey] = splitType(EphemeraId)
    switch(objectType) {
        case 'ROOM':
            const { render: Description, name: Name, exits, characters } = await renderItem({ CharacterId, EphemeraId })
            const Message = {
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
            return null        
    }
}


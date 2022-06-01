import { executeCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRooms } from './updateRooms.js'
import dependencyCascade from './dependencyCascade.js'
import { AssetKey, RoomKey } from '../types.js'
import { defaultColorFromCharacterId } from '../selfHealing/index.js'
import updateAssets from './updateAssets.js'

export const executeInAsset = (assetId, options = {}) => async (src) => {
    const { RoomId, CharacterId } = options
    const [{
            State: state = {},
            Dependencies: dependencies = {},
            importTree = {}
        },
        roomQueryItems,
        {
            Name = 'Someone',
            Color,
            Pronouns = {
                subject: 'they',
                object: 'them',
                possessive: 'their',
                adjective: 'theirs',
                reflexive: 'themself'
            }
        } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state', 'Dependencies', 'importTree'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: `ASSET#${assetId}`,
            KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
            ExpressionAttributeValues: {
                ':EphemeraPrefix': 'ROOM#'
            },
            ExpressionAttributeNames: {
                '#key': 'key'
            },
            ProjectionFields: ['EphemeraId', '#key']
        }),
        ...(CharacterId
            ? [
                ephemeraDB.getItem({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'Color', 'Pronouns'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                })
            ]
            : []
        )
    ])

    const valueState = Object.entries(state).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {})

    const executeMessageQueue = []

    const capitalize = (value) => ([value.slice(0, 1).toUppercase, value.slice(1)].join(''))
    const { changedKeys, newValues, returnValue } = executeCode(src)(
        valueState,
        {
            ...(roomQueryItems.reduce((previous, { EphemeraId, key }) => ({
                ...previous,
                [key]: {
                    message: (message) => {
                        if (EphemeraId) {
                            executeMessageQueue.push({
                                Targets: [EphemeraId],
                                DisplayProtocol: 'WorldMessage',
                                Message: [{ tag: 'String', value: message }]
                            })
                        }
                    }    
                }
            }), {})),
            here: {
                message: (message) => {
                    if (RoomId) {
                        executeMessageQueue.push({
                            Targets: [RoomKey(RoomId)],
                            DisplayProtocol: 'WorldMessage',
                            Message: [{ tag: 'String', value: message }]
                        })
                    }
                }
            },
            me: {
                Name,
                narrate: (message) => {
                    if (RoomId && CharacterId) {
                        executeMessageQueue.push({
                            Targets: [RoomKey(RoomId)],
                            DisplayProtocol: 'NarrateMessage',
                            Message: message,
                            CharacterId,
                            Name,
                            Color: Color || defaultColorFromCharacterId(CharacterId)
                        })
                    }
                },
                subject: Pronouns.subject,
                Subject: capitalize(Pronouns.subject),
                object: Pronouns.object,
                Object: capitalize(Pronouns.object),
                possessive: Pronouns.possessive,
                Possessive: capitalize(Pronouns.possessive),
                adjective: Pronouns.adjective,
                Adjective: capitalize(Pronouns.adjective),
                reflexive: Pronouns.reflexive,
                Reflexive: capitalize(Pronouns.reflexive),
            }
        }
    )
    
    const updatedState = Object.entries(newValues).reduce((previous, [key, value]) => ({
        ...previous,
        [key]: {
            ...(previous[key] || {}),
            value
        }
    }), state)

    const { states: firstPassStates, recalculated } = await dependencyCascade(
        {
            [assetId]: {
                State: updatedState,
                Dependencies: dependencies,
                importTree
            }
        },
        { [assetId]: changedKeys },
        []
    )

    const secondPassStates = await updateAssets({
        newStates: firstPassStates,
        recalculated
    })
    const recalculatedToRooms = ([asset, keys]) => (
        keys
            .map((key) => (secondPassStates[asset]?.Dependencies?.[key]?.room || []))
            .reduce((previous, rooms) => (
                rooms.reduce((accumulator, room) => ({
                    ...accumulator,
                    [room]: [...(accumulator[room] || []), asset]
                }), previous)),
            {})
    )
    const recalculatedToMaps = ([asset, keys]) => (
        keys
            .map((key) => (secondPassStates[asset]?.Dependencies?.[key]?.map || []))
            .reduce((previous, maps) => (
                maps.reduce((accumulator, map) => ({
                    ...accumulator,
                    [map]: [...(accumulator[map] || []), asset]
                }), previous)),
            {})
    )
    const assetsChangedByRoom = Object.entries(recalculated)
        .map(recalculatedToRooms)
        .reduce((previous, roomMap) => (
            Object.entries(roomMap)
                .reduce((accumulator, [room, assets = []]) => ({
                    ...accumulator,
                    [room]: [
                        ...(accumulator[room] || []),
                        ...assets
                    ]
                }), previous)
        ), {})
    const assetsChangedByMap = Object.entries(recalculated)
        .map(recalculatedToMaps)
        .reduce((previous, mapMap) => (
            Object.entries(mapMap)
                .reduce((accumulator, [mapId, assets = []]) => ({
                    ...accumulator,
                    [mapId]: [
                        ...(accumulator[mapId] || []),
                        ...assets
                    ]
                }), previous)
        ), {})

    await Promise.all([
        updateRooms({
            assetsChangedByRoom,
            assetsChangedByMap,
            existingStatesByAsset: secondPassStates
        })
    ])

    return {
        returnValue,
        executeMessageQueue
    }
}

export const executeAction = async ({ action, assetId, RoomId, CharacterId }) => {
    const { Actions: actions = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['Actions']
    })
    const { src = '' } = actions[action] || {}
    if (src) {
        return await executeInAsset(assetId, { RoomId, CharacterId })(src)
    }
    else {
        return {
            executeMessageQueue: []
        }
    }
}

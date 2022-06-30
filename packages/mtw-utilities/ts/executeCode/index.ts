import { executeCode } from '../computation/sandbox'
import { ephemeraDB } from '../dynamoDB'
import { updateRooms } from './updateRooms'
import dependencyCascade from './dependencyCascade'
import { AssetKey, RoomKey, splitType } from '../types'
import { defaultColorFromCharacterId } from '../selfHealing/index'
import updateAssets from './updateAssets'

export const executeInAsset = (assetId: string, options = {}) => async (src: string) => {
    const { RoomId, CharacterId }: { RoomId?: string ; CharacterId?: string } = options
    const [{
            State: state = {},
            Dependencies: dependencies = {},
            importTree = {}
        },
        roomQueryItems,
        mapQueryItems,
        characterQueryItem
    ] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state', 'Dependencies', 'importTree'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }) as any,
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
        ephemeraDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: `ASSET#${assetId}`,
            KeyConditionExpression: 'begins_with(EphemeraId, :EphemeraPrefix)',
            ExpressionAttributeValues: {
                ':EphemeraPrefix': 'MAP#'
            },
            ExpressionAttributeNames: {
                '#key': 'key'
            },
            ProjectionFields: ['EphemeraId', '#key', 'appearances']
        }),
        ...(CharacterId
            ? [
                ephemeraDB.getItem<{
                    Name: string;
                    Color: string;
                    Pronouns: {
                        subject: string;
                        object: string;
                        possessive: string;
                        adjective: string;
                        reflexive: string;
                    }
                }>({
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
    const {
        Name = 'Someone',
        Color = '',
        Pronouns = {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            adjective: 'theirs',
            reflexive: 'themself'
        }
    } = characterQueryItem || {}

    const valueState = Object.entries(state).reduce((previous, [key, item]) => ({ ...previous, [key]: (item as { value: any })?.value }), {})

    const executeMessageQueue: { Targets: string[], DisplayProtocol: string; Message: any[], CharacterId?: string, Color?: string, Name?: string }[] = []

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
            }), {} as Partial<{ EphemeraId: string; key: string }>)),
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
                            Message: [{ tag: 'String', value: message }],
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
    const recalculatedToMaps = ([asset, keys]) => {
        const mapsDirectlyDependent = keys
            .map((key) => (secondPassStates[asset]?.Dependencies?.[key]?.map || []))
            .reduce((previous, maps) => (
                maps.reduce((accumulator, map) => ({
                    ...accumulator,
                    [map]: [...(accumulator[map] || []), asset]
                }), previous)),
            {})
        const mapsWithCacheDependencies = keys
            .map((key) => (secondPassStates[asset]?.Dependencies?.[key]?.mapCache || []))
            .reduce((previous, roomsUpdated) => {
                const mapsReferencingUpdatedRoom = mapQueryItems.filter((mapQuery) => (
                    (mapQuery.appearances || [])
                        .map(({ rooms }: { rooms: Record<string, { EphemeraId: string }> }) => (
                            Object.values(rooms).map(({ EphemeraId }) => (splitType(EphemeraId)[1]))
                        ))
                        .find((rooms) => (roomsUpdated.find((roomId) => (rooms.includes(roomId)))))
                ))
                .map(({ EphemeraId }) => (splitType(EphemeraId)[1]))
                return mapsReferencingUpdatedRoom.reduce((accumulator, map) => ({
                        ...accumulator,
                        [map]: [...(accumulator[map] || []), asset]
                    }), previous)
            }, mapsDirectlyDependent)
        return mapsWithCacheDependencies
    }
    const assetsChangedByRoom = Object.entries(recalculated)
        .map(recalculatedToRooms)
        .reduce((previous, roomMap) => (
            Object.entries(roomMap)
                .reduce((accumulator, [room, assets = []]) => ({
                    ...accumulator,
                    [room]: [
                        ...(accumulator[room] || []),
                        ...(assets as any[])
                    ]
                }), previous as Record<string, any>)
        ), {})
    const assetsChangedByMap = Object.entries(recalculated)
        .map(recalculatedToMaps)
        .reduce((previous, mapMap) => (
            Object.entries(mapMap)
                .reduce((accumulator, [mapId, assets = []]) => ({
                    ...accumulator,
                    [mapId]: [
                        ...(accumulator[mapId] || []),
                        ...(assets as any[])
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
    }) as any
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

import { executeCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRooms } from './updateRooms.js'
import dependencyCascade from './dependencyCascade.js'
import { AssetKey, RoomKey } from '../types.js'

export const executeInAsset = (assetId, options = {}) => async (src) => {
    const { RoomId, CharacterId } = options
    const [{ State: state = {}, Dependencies: dependencies = {}, importTree = {} }, { Name = 'Someone' } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state', 'Dependencies', 'importTree'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        ...(CharacterId
            ? [
                ephemeraDB.getItem({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name'],
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

    const { changedKeys, newValues, returnValue } = executeCode(src)(
        valueState,
        {
            ...(RoomId
                ? {
                    here: {
                        worldMessage: (message) => {
                            executeMessageQueue.push({
                                Targets: [RoomKey(RoomId)],
                                DisplayProtocol: 'WorldMessage',
                                Message: message
                            })
                        }
                    }
                }
                : {}
            ),
            me: {
                Name
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

    const { states: newStates, recalculated } = await dependencyCascade(
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

    await Promise.all(Object.entries(newStates)
        .map(([key, newState]) => (
            ephemeraDB.update({
                EphemeraId: AssetKey(key),
                DataCategory: 'Meta::Asset',
                UpdateExpression: 'SET #state = :state',
                ExpressionAttributeNames: {
                    '#state': 'State'
                },
                ExpressionAttributeValues: {
                    ':state': newState.State
                }
            })    
        ))
    )
    const recalculatedToRooms = ([asset, keys]) => (
        keys
            .map((key) => (newStates[asset]?.Dependencies?.[key]?.room || []))
            .reduce((previous, rooms) => (
                rooms.reduce((accumulator, room) => ({
                    ...accumulator,
                    [room]: [...(accumulator[room] || []), asset]
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

    await Promise.all([
        updateRooms({
            assetsChangedByRoom
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

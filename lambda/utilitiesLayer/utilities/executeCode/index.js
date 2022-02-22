import { executeCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRooms } from './updateRooms.js'
import dependencyCascade from './dependencyCascade.js'

export const executeInAsset = (assetId) => async (src) => {
    const { State: state = {}, Dependencies: dependencies = {}, importMap = {} } = await ephemeraDB.getItem({
        EphemeraId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state', 'Dependencies', 'importMap'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    })
    const valueState = Object.entries(state).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {})
    const { changedKeys, newValues, returnValue } = executeCode(src)(valueState)
    const updatedState = Object.entries(newValues).reduce((previous, [key, value]) => ({
        ...previous,
        [key]: {
            ...(previous[key] || {}),
            value
        }
    }), state)
    const { states: newStates, recalculated } = await dependencyCascade(
        { [assetId]: updatedState },
        { [assetId]: dependencies },
        { [assetId]: changedKeys }
    )

    await Promise.all(Object.entries(newStates)
        .map(([key, newState]) => (
            ephemeraDB.update({
                EphemeraId: `ASSET#${key}`,
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
            .map((key) => (newStates[asset]?.dependencies?.room || []))
            .reduce((previous, keys) => ([ ...previous, ...keys ]), [])
    )
    const roomsToCheck = [...(new Set(
        Object.entries(recalculated)
            .map(recalculatedToRooms)
            .reduce((previous, rooms) => ([ ...previous, ...rooms ]), [])
    ))]
    await Promise.all([
        updateRooms(roomsToCheck)
    ])

    return returnValue
}

export const executeAction = async ({ action, assetId }) => {
    const { Actions: actions = {} } = await ephemeraDB.getItem({
        EphemeraId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['Actions']
    })
    const { src = '' } = actions[action] || {}
    if (src) {
        await executeInAsset(assetId)(src)
    }
}

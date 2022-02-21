import { executeCode, evaluateCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRooms } from './updateRooms.js'
import { recalculateComputes } from './recalculateComputes.js'

export const executeInAsset = (AssetId) => async (src) => {
    const { State: state = {}, Dependencies: dependencies = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetId,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state', 'Dependencies'],
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
    const { state: newState, recalculated } = recalculateComputes(updatedState, dependencies, changedKeys)

    await Promise.all([
        ephemeraDB.update({
            EphemeraId: AssetId,
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                '#state': 'State'
            },
            ExpressionAttributeValues: {
                ':state': newState
            }
        })
    ])
    const roomsToCheck = [...(new Set(recalculated.reduce((previous, key) => ([
        ...previous,
        ...(dependencies[key]?.room || [])
    ]), [])))]
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
        await executeInAsset(`ASSET#${assetId}`)(src)
    }
}

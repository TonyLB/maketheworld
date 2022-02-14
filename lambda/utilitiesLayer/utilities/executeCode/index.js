import { executeCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRoomsByAsset } from './updateRooms.js'

export const executeInAsset = (AssetId) => async (src) => {
    const { State: state = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetId,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    })
    const valueState = Object.entries(state).reduce((previous, [key, { value }]) => ({ ...previous, [key]: value }), {})
    const { changedKeys, newValues, returnValue } = executeCode(src)(valueState)
    const newValuesByEphemeraId = Object.entries(state).reduce((previous, [scopedId, { EphemeraId }]) => ({ ...previous, [EphemeraId]: newValues[scopedId] }), {})
    const updatingVariables = await ephemeraDB.batchGetItem({
        Items: changedKeys.map((key) => ({
            EphemeraId: state[key].EphemeraId,
            DataCategory: 'Meta::Variable'
        })),
        ProjectionFields: ['EphemeraId', 'scopedIdByAsset'],
    })

    //
    // Calculate, for each Asset that will be effected by these variable changes, which variables
    // get updated, to what values, with which EphemeraIds
    //
    const updatesByAsset = updatingVariables.reduce((previous, { EphemeraId, scopedIdByAsset }) => {
        if (!EphemeraId) {
            return previous
        }
        const stateUpdateProp = {
            EphemeraId,
            value: newValuesByEphemeraId[EphemeraId]
        }
        return Object.entries(scopedIdByAsset).reduce((accumulator, [scopingAssetId, scopedId]) => ({
            ...accumulator,
            [scopingAssetId]: {
                ...(accumulator[scopingAssetId] || {}),
                [scopedId]: stateUpdateProp
            }
        }), previous)
    }, {})

    //
    // Now apply all of those updates in parallel, along with the updates to the actual Meta::Variable
    // values
    //

    await Promise.all([
        ...(Object.entries(updatesByAsset)
            .map(async ([updateAssetId, stateUpdates]) => {
                const updateSubExpression = Object.entries(stateUpdates)
                    .map((_, index) => (`#state.#arg${index} = :arg${index}`))
                const ExpressionAttributeNames = Object.entries(stateUpdates)
                    .reduce((previous, [key], index) => ({ ...previous, [`#arg${index}`]: key }), { '#state': 'State' })
                const ExpressionAttributeValues = Object.entries(stateUpdates)
                    .reduce((previous, [_, props], index) => ({ ...previous, [`:arg${index}`]: props }), {})
                
                await ephemeraDB.update({
                    EphemeraId: `ASSET#${updateAssetId}`,
                    DataCategory: 'Meta::Asset',
                    UpdateExpression: `SET ${updateSubExpression.join(', ')}`,
                    ExpressionAttributeNames,
                    ExpressionAttributeValues
                })
            })
        ),
        ...(changedKeys
            .map((key) => (
                ephemeraDB.update({
                    EphemeraId: state[key].EphemeraId,
                    DataCategory: 'Meta::Variable',
                    UpdateExpression: 'SET #value = :value',
                    ExpressionAttributeNames: {
                        '#value': 'value'
                    },
                    ExpressionAttributeValues: {
                        ':value': newValues[key]
                    }
                })
            ))
        ),
    ])
    await Promise.all(Object.keys(updatesByAsset).map((updateAssetId) => (updateRoomsByAsset(updateAssetId))))

    return returnValue
}

export const executeAction = async (EphemeraId) => {
    const { namespaceAsset, src } = await ephemeraDB.getItem({
        EphemeraId,
        DataCategory: 'Meta::Action',
        ProjectionFields: ['src', 'namespaceAsset']
    })
    await executeInAsset(`ASSET#${namespaceAsset}`)(src)
}

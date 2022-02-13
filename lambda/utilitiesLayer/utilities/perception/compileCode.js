import { produce } from 'immer'
import { ephemeraDB } from '../dynamoDB/index.js'

const sandboxedExecution = (src) => (sandboxTransform) => {
    src = 'with (sandbox) {' + src + '}'
    const code = new Function('sandbox', src)
    return (sandbox) => {
        const sandboxProxy = sandboxTransform(sandbox)
        return code(sandboxProxy)
    }
}

export const evaluateCode = (src) => {
    const transform = (sandbox) => (new Proxy(sandbox, {
        has: () => true,
        get: (target, key) => (key === Symbol.unscopables ? undefined: target[key])
    }))
    return sandboxedExecution(src)(transform)
}

export const executeCode = (src) => (sandbox) => {
    let returnValue = null
    const updatedSandbox = produce(sandbox, (draftSandbox) => {
        const transform = (sandbox) => (new Proxy(sandbox, {
            has: () => true,
            get: (target, key) => (key === Symbol.unscopables ? undefined: target[key]),
            set: (target, key, value) => {
                if (key === Symbol.unscopables) {
                    return null
                }
                else {
                    return Reflect.set(target, key, value)
                }
            }
        }))
        returnValue = sandboxedExecution(src)(transform)(draftSandbox)
    })
    const changedKeys = Object.keys(sandbox)
        .filter((key) => (updatedSandbox[key] !== sandbox[key]))
    return {
        oldValues: sandbox,
        newValues: updatedSandbox,
        changedKeys,
        returnValue
    }
}

//
// First-draft naive execution, which does all the fetching and rewriting for
// each function call.  To be replaced by a system smart enough to combine
// several function calls in a single run.
//
const refreshAssetState = async (EphemeraId) => {
    const { State: currentState } = await ephemeraDB.getItem({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    })
    const variablesToRefreshFrom = Object.values(currentState).map(({ EphemeraId }) => (EphemeraId))
    const variableValues = await ephemeraDB.batchGetItem({
        Items: variablesToRefreshFrom.map((EphemeraId) => ({ EphemeraId, DataCategory: 'Meta::Variable' })),
        ProjectionFields: ['EphemeraId', '#value'],
        ExpressionAttributeNames: {
            '#value': 'value'
        }
    })
    const variableNamesByEphemeraId = Object.entries(currentState).reduce((previous, [key, { EphemeraId }]) => ({ ...previous, [EphemeraId]: key }), {})
    const newState = variableValues.reduce((previous, { EphemeraId, value }) => {
        if (variableNamesByEphemeraId[EphemeraId]) {
            return {
                ...previous,
                [variableNamesByEphemeraId[EphemeraId]]: {
                    EphemeraId,
                    value
                }
            }
        }
        return previous
    }, {})
    await ephemeraDB.update({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        UpdateExpression: 'SET #state = :state',
        ExpressionAttributeNames: {
            '#state': 'State'
        },
        ExpressionAttributeValues: {
            ':state': newState
        }
    })
}

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
        return Object.entries(scopedIdByAsset).reduce((accumulator, [AssetId, scopedId]) => ({
            ...accumulator,
            [AssetId]: {
                ...(accumulator[AssetId] || {}),
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
            .map(async ([AssetId, stateUpdates]) => {
                const updateSubExpression = Object.entries(stateUpdates)
                    .map((_, index) => (`#state.#arg${index} = :arg${index}`))
                const ExpressionAttributeNames = Object.entries(stateUpdates)
                    .reduce((previous, [key], index) => ({ ...previous, [`#arg${index}`]: key }), { '#state': 'State' })
                const ExpressionAttributeValues = Object.entries(stateUpdates)
                    .reduce((previous, [_, props], index) => ({ ...previous, [`:arg${index}`]: props }), {})
                
                await ephemeraDB.update({
                    EphemeraId: `ASSET#${AssetId}`,
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
        )
    ])

    return returnValue
}

export default evaluateCode

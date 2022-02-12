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
    await Promise.all(changedKeys.map(async (key) => {
        const { EphemeraId = '' } = state[key]
        if (EphemeraId) {
            const [assetDependencyItems] = await Promise.all([
                ephemeraDB.query({
                    EphemeraId,
                    KeyConditionExpression: 'begins_with(DataCategory, :dc)',
                    ExpressionAttributeValues: {
                        ':dc': 'ASSET#'
                    }
                }),
                ephemeraDB.update({
                    EphemeraId,
                    DataCategory: 'Meta::Variable',
                    UpdateExpression: 'SET #value = :value',
                    ExpressionAttributeNames: {
                        '#value': 'value'
                    },
                    ExpressionAttributeValues: {
                        ':value': newValues[key]
                    }
                })
            ])
            const assetsToRepopulate = [...(new Set(assetDependencyItems
                    .map(({ DataCategory }) => (DataCategory))
                ))]
            await Promise.all(assetsToRepopulate.map(refreshAssetState))
        }
        return []
    }))
    return returnValue
}

export default evaluateCode

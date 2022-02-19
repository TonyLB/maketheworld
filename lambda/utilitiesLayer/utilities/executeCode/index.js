import { executeCode, evaluateCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRoomsByAsset } from './updateRooms.js'

const dependencyCascadeHelper = (dependencies, recalculatedLayerMap, depth = 0) => {
    const layerItems = Object.entries(recalculatedLayerMap)
        .filter(([_, value]) => (value === depth))
        .map(([key]) => (key))
    if (layerItems.length === 0) {
        return recalculatedLayerMap
    }
    const updatedMap = layerItems.reduce((previous, item) => {
        const itemsNeedingRecalc = dependencies[item]?.computed || []
        return itemsNeedingRecalc.reduce((accumulator, recalc) => ({
            ...accumulator,
            [recalc]: depth + 1
        }), previous)
    }, recalculatedLayerMap)
    const checkForCircular = Array(depth+1).fill(0).map((_, index) => {
        const layerProbe = Object.values(updatedMap).filter((layer) => (layer === index))
        return layerProbe.length === 0
    }).reduce((previous, probe) => (previous || probe), false)
    if (checkForCircular) {
        console.log('Circular dependency short-circuited')
        return recalculatedLayerMap
    }
    return dependencyCascadeHelper(dependencies, updatedMap, depth + 1)
}

const dependencyCascade = (dependencies, recalculated) => {
    const recalculatedLayerMap = dependencyCascadeHelper(
        dependencies,
        recalculated.reduce((previous, key) => ({ ...previous, [key]: 0 }), {}),
    )
    return Object.entries(recalculatedLayerMap)
        .filter(([_, layer]) => (layer > 0))
        .sort(([keyA, a], [keyB, b]) => (a - b))
        .map(([key]) => (key))
}

export const recalculateComputes = (state, dependencies, recalculated) => {
    const dependencyOrder = dependencyCascade(dependencies, recalculated)
    const updatedState = dependencyOrder.reduce((previous, dependencyCheck) => {
        //
        // Because not every recalculation actually changes a value, the dependencyOrder
        // is only a suggestion for the order to check whether things *DO* have a need
        // to be updated.  Some of them, when we get to them, will find that all their
        // past arguments are the same as they were at the beginning of the recalculation,
        // and therefore will pass on recalculating.
        //
        const checkMemo = previous.recalculated
            .find((key) => ((dependencies[key]?.computed || []).includes(dependencyCheck)))
        if (!checkMemo && (updatedState[key]?.value !== undefined)) {
            return previous
        }
        //
        // Now that you know you really need to recalculate, grab the source with which to
        // do so.
        //
        const currentSrc = state[dependencyCheck]?.src || ''
        if (!currentSrc) {
            return previous
        }
        const valueState = Object.entries(previous.state).reduce((accumulator, [key, { value }]) => ({ ...accumulator, [key]: value }), {})
        const updatedValue = evaluateCode(` return (${currentSrc}) `)(valueState)
        if (updatedValue === valueState[dependencyCheck]) {
            return previous
        }
        return {
            state: {
                ...previous.state,
                [dependencyCheck]: {
                    ...(previous.state[dependencyCheck] || {}),
                    value: updatedValue
                }
            },
            recalculated: [
                ...previous.recalculated,
                dependencyCheck
            ]
        }
    }, { state, recalculated })

    return updatedState
}

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
    const newValuesByEphemeraId = Object.entries(state).reduce((previous, [scopedId, { EphemeraId }]) => ({ ...previous, [EphemeraId]: newValues[scopedId] }), {})
    const updatingVariables = await ephemeraDB.batchGetItem({
        Items: changedKeys.map((key) => ({
            EphemeraId: state[key].EphemeraId,
            DataCategory: 'Meta::Variable'
        })),
        ProjectionFields: ['EphemeraId', 'scopedIdByAsset'],
    })

    //
    // TODO: Rewrite the below to use room dependencies to limit its recalculations
    //

    //
    // TODO: Deprecate Meta::Variable, and store values directly (and exclusively) on Asset state items.
    // This will be a big honkin' deal for instantiating separate namespaces for stories.
    //

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

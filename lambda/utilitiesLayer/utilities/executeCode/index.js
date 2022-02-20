import { executeCode, evaluateCode } from '../computation/sandbox.js'
import { ephemeraDB } from '../dynamoDB/index.js'
import { updateRooms } from './updateRooms.js'

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

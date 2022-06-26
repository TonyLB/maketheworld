import { evaluateCode } from '../computation/sandbox.js'

const dependencyCascadeHelper = (dependencies: Record<string, any>, recalculatedLayerMap: Record<string, number>, depth = 0): Record<string, number> => {
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
        .filter(([_, layer]) => ((layer as number) > 0))
        .sort(([keyA, a], [keyB, b]) => (a - b))
        .map(([key]) => (key))
}

export const recalculateComputes = (state, dependencies, recalculated) => {
    const dependencyOrder = dependencyCascade(dependencies, recalculated)
    const updatedState = dependencyOrder
        .filter((dependencyCheck) => (!recalculated.includes(dependencyCheck)))
        .reduce((previous, dependencyCheck) => {
        //
        // Because not every recalculation actually changes a value, the dependencyOrder
        // is only a suggestion for the order to check whether things *DO* have a need
        // to be updated.  Some of them, when we get to them, will find that all their
        // past arguments are the same as they were at the beginning of the recalculation,
        // and therefore will pass on recalculating.
        //
        const checkMemo = previous.recalculated
            .find((key) => ((dependencies[key]?.computed || []).includes(dependencyCheck)))
        if (!checkMemo) {
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
        const valueState = Object.entries(previous.state).reduce((accumulator, [key, item]) => ({ ...accumulator, [key]: (item as any)?.value }), {})
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

export default recalculateComputes

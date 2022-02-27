import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'

const mapContextStackToConditions = (normalForm) => ({ contextStack, ...rest }) => ({
    conditions: contextStack.reduce((previous, { key, tag }) => {
        if (tag !== 'Condition') {
            return previous
        }
        const { if: condition = '', dependencies = [] } = normalForm[key]
        return [
            ...previous,
            {
                if: condition,
                dependencies
            }
        ]
    }, []),
    ...rest
})

export const fetchAssetState = async (assetId) => {
    const { State = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    }) || {}
    return State
}

export const extractDependencies = (normalForm) => {
    const computeDependencies = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, dependencies }) => (
            dependencies.reduce((accumulator, dependency) => ({
                ...accumulator,
                [dependency]: {
                    computed: [
                        ...(accumulator[dependency]?.computed || []),
                        key
                    ]
                }
            }), previous)
        ), {})

    const dependencies = Object.values(normalForm)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances
                .map(mapContextStackToConditions(normalForm))
                .reduce((accumulator, { conditions = [] }) => (
                    conditions.reduce((innerAccumulator, { dependencies = [] }) => (
                        dependencies.reduce((innermostAccumulator, dependency) => ({
                            ...innermostAccumulator,
                            [dependency]: {
                                ...(innermostAccumulator[dependency] || {}),
                                room: [...(new Set([
                                    ...(innermostAccumulator[dependency]?.room || []),
                                    //
                                    // Extract the globalized RoomId
                                    //
                                    splitType(EphemeraId)[1]
                                ]))]
                            }
                        }), innerAccumulator)
                    ), accumulator)
                ), previous)
        ), computeDependencies)

    return dependencies
}

export const extractStartingState = async (normalForm, currentState = {}) => {
    const variableState = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Variable'))
        .reduce((previous, { key, default: defaultValue }) => {
            if (previous[key]?.value !== undefined) {
                return previous
            }
            const defaultEvaluation = evaluateCode(`return (${defaultValue})`)({})
            return {
                ...previous,
                [key]: {
                    value: defaultEvaluation
                }
            }
        }, currentState)

    const importAssetsToFetch = [...new Set(Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Import'))
        .map(({ from }) => (from)))]

    const importAssetStates = await ephemeraDB.batchGetItem({
        Items: importAssetsToFetch
            .map((assetId) => ({
                EphemeraId: AssetKey(assetId),
                DataCategory: 'Meta::Asset'
            })),
        ProjectionFields: ['#state', 'Dependencies', 'EphemeraId'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    })

    const importStateByAsset = (importAssetStates || [])
        .reduce((previous, { State: state, Dependencies: dependencies, EphemeraId }) => {
            const assetId = splitType(EphemeraId)[1]
            if (assetId) {
                return {
                    ...previous,
                    [assetId]: {
                        state,
                        dependencies
                    }
                }
            }
            return previous
        }, {})

    const importState = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Import'))
        .reduce((previous, { from, mapping }) => {
            return Object.entries(mapping)
                .filter(([_, awayKey]) => (awayKey in importStateByAsset[from].state))
                .reduce((accumulator, [localKey, awayKey]) => ({
                    ...accumulator,
                    [localKey]: {
                        imported: true,
                        asset: from,
                        key: awayKey,
                        value: importStateByAsset[from]?.state?.[awayKey]?.value
                    }
                }), previous)
        }, variableState)

    const uncomputedState = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), importState)

    return uncomputedState

}
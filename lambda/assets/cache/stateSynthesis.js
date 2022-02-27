import { produce } from 'immer'

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

const extractComputed = (normalForm) => {
    const uncomputedState = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), {})

    return uncomputedState
}

const mergeStateReducer = (previous, [key, value]) => ({
    ...previous,
    [key]: {
        ...(previous[key] || {}),
        ...value
    }
})

export class StateSynthesizer extends Object {
    constructor(assetId, normalForm) {
        super()
        this.assetId = assetId
        this.normalForm = normalForm
        this.dependencies = extractDependencies(normalForm)
        this.state = extractComputed(normalForm)
    }

    async fetchFromEphemera() {
        const { State: incomingState = {} } = await ephemeraDB.getItem({
            EphemeraId: AssetKey(this.assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }) || {}
        this.state = Object.entries(incomingState)
            .reduce(mergeStateReducer, this.state || {})
    }

    evaluateDefaults() {
        const variableState = Object.values(this.normalForm)
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
            }, this.state)
        this.state = variableState
    }

    async fetchImportedValues() {
        const importAssetsToFetch = [...new Set(Object.values(this.normalForm)
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

        this.importedStates = importStateByAsset

        const importState = Object.values(this.normalForm)
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
            }, this.state)

        this.state = importState
    }

    async updateImportedDependencies() {
        const updateAssetDependencies = produce(this.importedStates, (draft) => {
            Object.values(this.normalForm)
                .filter(({ tag }) => (tag === 'Import'))
                .filter(({ from }) => (from in this.importedStates))
                .forEach(({ from, mapping }) => {
                    if (draft[from]) {
                        if (!draft[from].dependencies) {
                            draft[from].dependencies = {}
                        }
                        Object.entries(mapping).forEach(([localKey, awayKey]) => {
                            if (awayKey in this.importedStates[from].state) {
                                if (!(awayKey in draft[from].dependencies)) {
                                    draft[from].dependencies[awayKey] = {}
                                }
                                if (!('imported' in draft[from].dependencies[awayKey])) {
                                    draft[from].dependencies[awayKey].imported = []
                                }
                                draft[from].dependencies[awayKey].imported = [
                                    ...((draft[from].dependencies[awayKey].imported || []).filter(({ asset, key }) => (asset !== this.assetId || key !== localKey))),
                                    {
                                        asset: this.assetId,
                                        key: localKey
                                    }
                                ]
                            }
                        })
                    }
                })
        })

        //
        // TODO: Upgrade with optimisticUpdate, when created
        //
        await Promise.all(Object.entries(updateAssetDependencies)
            .map(([assetId, { dependencies }]) => (
                ephemeraDB.update({
                    EphemeraId: AssetKey(assetId),
                    DataCategory: 'Meta::Asset',
                    UpdateExpression: 'SET Dependencies = :dependencies',
                    ExpressionAttributeValues: {
                        ':dependencies': dependencies
                    }
                })
            ))
        )
    }
}

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

export default StateSynthesizer

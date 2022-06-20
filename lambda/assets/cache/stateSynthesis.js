import { produce } from 'immer'

import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { splitType, AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox.js'
import { objectFilter } from '../lib/objects.js'

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
        .filter(({ tag }) => (['Room', 'Map'].includes(tag)))
        .reduce((previous, { tag, EphemeraId, appearances = [] }) => (
            appearances
                .map(mapContextStackToConditions(normalForm))
                .reduce((accumulator, { conditions = [], name = [], contents = [] }) => (
                    conditions.reduce((innerAccumulator, { dependencies = [] }) => (
                        dependencies.reduce((innermostAccumulator, dependency) => {
                            const mapCacheDependency = (tag === 'Room') && ((name.length > 0) || (contents.filter(({ tag }) => (tag === 'Exit')).length > 0))
                            return {
                                ...innermostAccumulator,
                                [dependency]: {
                                    ...(innermostAccumulator[dependency] || {}),
                                    //
                                    // For a map, add to the map dependencies
                                    //
                                    ...((tag === 'Map')
                                        ? {
                                            map: [...(new Set([
                                                ...(innermostAccumulator[dependency]?.map || []),
                                                //
                                                // Extract the globalized MapId
                                                //
                                                splitType(EphemeraId)[1]
                                            ]))]
                                        }
                                        : {}
                                    ),
                                    //
                                    // For a room, add to the room dependencies
                                    //
                                    ...((tag === 'Room')
                                        ? {
                                            room: [...(new Set([
                                                ...(innermostAccumulator[dependency]?.room || []),
                                                //
                                                // Extract the globalized RoomId
                                                //
                                                splitType(EphemeraId)[1]
                                            ]))]
                                        }
                                        : {}
                                    ),
                                    //
                                    // For a room with name or exit changes, also add to the mapCache dependencies
                                    //
                                    ...(mapCacheDependency
                                        ? {
                                            mapCache: [...(new Set([
                                                ...(innermostAccumulator[dependency]?.mapCache || []),
                                                //
                                                // Extract the globalized RoomId
                                                //
                                                splitType(EphemeraId)[1]
                                            ]))]
                                        }
                                        : {})
                                }
                            }
                        }, innerAccumulator)
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
            .filter(([key, { computed }]) => (this.normalForm[key]?.tag === 'Variable' && !computed))
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
                    .filter(([_, { key: awayKey }]) => (awayKey in importStateByAsset[from].state))
                    .reduce((accumulator, [localKey, { key: awayKey }]) => ({
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
            Object.values(draft).forEach((dependencyRecord) => {
                Object.values(dependencyRecord.dependencies).forEach((item) => {
                    item.imported = item.imported.filter(({ asset, key }) => (asset !== this.assetId || ['Variable', 'Computed'].includes(this.normalForm[key]?.tag)))
                })
                dependencyRecord.dependencies = objectFilter(dependencyRecord.dependencies, ({ imported }) => (imported.length > 0))
            })
            Object.values(this.normalForm)
                .filter(({ tag }) => (tag === 'Import'))
                .filter(({ from }) => (from in this.importedStates))
                .forEach(({ from, mapping }) => {
                    if (draft[from]) {
                        if (!draft[from].dependencies) {
                            draft[from].dependencies = {}
                        }
                        Object.entries(mapping).forEach(([localKey, { key: awayKey }]) => {
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
        // Experimental:  Try processing the normal form by aggregating all appearances for all objects, then
        // filtering on the contextStack to get the right elements
        //
        const allAppearances = Object.values(this.normalForm)
            .reduce((previous, { appearances = [], ...rest }) => ([
                ...previous,
                ...(appearances.map((appearance) => ({ item: rest, ...appearance })))
            ]), [])
        const mapDependenciesByRoom = allAppearances
            .filter(({ item: { tag } }) => (tag === 'Room'))
            .reduce((previous, { item: { EphemeraId }, contextStack = [] }) => {
                const { key } = contextStack.find(({ tag }) => (tag === 'Map')) || {}
                const mapId = this.normalForm[key]?.EphemeraId
                if (mapId) {
                    return {
                        ...previous,
                        [EphemeraId]: [...(new Set([
                            ...(previous[EphemeraId] || []),
                            mapId
                        ]))]
                    }    
                }
                else {
                    return previous
                }
            }, {})

        const updateMapDependencyOnRoom = async ({ EphemeraId, Dependencies }) => {
            const { Dependencies: fetchedDependencies = {} } = await ephemeraDB.getItem({
                EphemeraId,
                DataCategory: 'Meta::Room',
                ProjectionFields: ['Dependencies']
            })
            const newDependencies = {
                ...fetchedDependencies,
                map: [
                    ...(fetchedDependencies.map || []),
                    ...Dependencies
                ]
            }
            await ephemeraDB.update({
                EphemeraId,
                DataCategory: 'Meta::Room',
                UpdateExpression: 'SET Dependencies = :dependencies',
                ExpressionAttributeValues: {
                    ':dependencies': newDependencies
                }
            })
        }

        //
        // TODO: Upgrade with optimisticUpdate, when created
        //
        await Promise.all([
            ...(Object.entries(updateAssetDependencies)
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
            ),
            ...(Object.entries(mapDependenciesByRoom)
                .map(([EphemeraId, Dependencies]) => ({ EphemeraId, Dependencies }))
                .map(updateMapDependencyOnRoom)
            )
        ])
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

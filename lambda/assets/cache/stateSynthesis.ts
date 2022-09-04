import { produce } from 'immer'

import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType, AssetKey } from '@tonylb/mtw-utilities/dist/types'
import { evaluateCode } from '@tonylb/mtw-utilities/dist/computation/sandbox'
import { objectFilter } from '../lib/objects.js'
import { conditionsFromContext } from './utilities'
import { NamespaceMapping } from '@tonylb/mtw-asset-workspace/dist/'
import {
    isNormalRoom,
    isNormalMap,
    NormalForm,
    isNormalComputed,
    isNormalVariable
} from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { unique } from '@tonylb/mtw-utilities/dist/lists'
import { EphemeraDependencies, EphemeraImportState, EphemeraState, isEphemeraStateComputed, isEphemeraStateVariable } from './baseClasses'
import { isNormalImport } from '@tonylb/mtw-wml/dist/normalize'

export const extractDependencies = (namespaceIdToDB: NamespaceMapping, normalForm: NormalForm): EphemeraDependencies => {
    const conditionTransform = conditionsFromContext(normalForm)
    const computeDependencies = Object.values(normalForm)
        .filter(isNormalComputed)
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
        ), {} as EphemeraDependencies)

    //
    // Update each variable or compute upon which the room's render conditions are dependent, to notify it that
    // it has the room as a dependency and needs to rerender it upon a change to the value.
    //
    const computeAndRoomDependencies = Object.values(normalForm)
        .filter(isNormalRoom)
        .reduce((previous, { key, appearances = [] }) => {
            const globalKey = splitType(namespaceIdToDB[key] || '#')[1]
            if (!globalKey) {
                return previous
            }
            return appearances
                .map(({ contextStack, ...rest }) => ({ conditions: conditionTransform(contextStack), ...rest }))
                .reduce((accumulator, { conditions = [], name = [], contents = [] }) => (
                    produce(accumulator, (draft) => {
                        conditions.forEach(({ dependencies = [] }) => {
                            dependencies.forEach((dependency) => {
                                if (!(dependency in draft)) {
                                    draft[dependency] = {}
                                }
                                draft[dependency].room = unique([globalKey], draft[dependency].room || [])
                                //
                                // Update the mapCache dependencies only when the room is changed in a way that would
                                // side-effect the mapCache used by all maps to render rooms and their relationships
                                //
                                if (name.length > 0 || (contents.filter(({ tag }) => (tag === 'Exit')).length > 0)) {
                                    draft[dependency].mapCache = unique([globalKey], draft[dependency].mapCache || [])
                                }
                            })
                        })
                    })), previous)
        }, computeDependencies as EphemeraDependencies)

    //
    // Update each variable or compute upon which the map's render conditions are dependent, to notify it that
    // it has the map as a dependency and needs to rerender it upon a change to the value.
    //
    const dependencies = Object.values(normalForm)
        .filter(isNormalMap)
        .reduce((previous, { key, appearances = [] }) => {
            const globalKey = splitType(namespaceIdToDB[key] || '#')[1]
            if (!globalKey) {
                return previous
            }
            return appearances
                .map(({ contextStack, ...rest }) => ({ conditions: conditionTransform(contextStack), ...rest }))
                .reduce((accumulator, { conditions = [], name = [], contents = [] }) => (
                    produce(accumulator, (draft) => {
                        conditions.forEach(({ dependencies = [] }) => {
                            dependencies.forEach((dependency) => {
                                if (!(dependency in draft)) {
                                    draft[dependency] = {}
                                }
                                draft[dependency].map = unique([globalKey], draft[dependency].map || [])
                            })
                        })
                    })), previous)
        }, computeAndRoomDependencies as EphemeraDependencies)

    return dependencies
}

const extractComputed = (normalForm: NormalForm): EphemeraState => {
    const uncomputedState = Object.values(normalForm)
        .filter(isNormalComputed)
        .reduce<EphemeraState>((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), {} as EphemeraState)

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
    assetId: string;
    namespaceIdToDB: NamespaceMapping;
    normalForm: NormalForm;
    dependencies: EphemeraDependencies;
    state: EphemeraState;
    importedStates: EphemeraImportState = {};
    constructor(namespaceIdToDB: NamespaceMapping, normalForm: NormalForm) {
        super()
        this.namespaceIdToDB = namespaceIdToDB
        this.normalForm = normalForm
        this.assetId = (Object.values(normalForm).find(({ tag }) => (tag === 'Asset')) || { key: '' }).key
        this.dependencies = extractDependencies(namespaceIdToDB, normalForm)
        this.state = extractComputed(normalForm)
    }

    async fetchFromEphemera() {
        const { State: incomingState = {} } = await ephemeraDB.getItem<{ State: EphemeraState }>({
            EphemeraId: AssetKey(this.assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }) || {}
        this.state = Object.entries(incomingState)
            .filter(([key, item]) => (isEphemeraStateVariable(item)))
            .filter(([key]) => (this.normalForm[key]?.tag === 'Variable'))
            .reduce(mergeStateReducer, this.state || {})
    }

    evaluateDefaults() {
        const variableState = Object.values(this.normalForm)
            .filter(isNormalVariable)
            .reduce<EphemeraState>((previous, { key, default: defaultValue }) => {
                const previousItem = previous[key]
                if (previousItem && isEphemeraStateComputed(previousItem)) {
                    return previous
                }
                if (previousItem?.value !== undefined) {
                    return previous
                }
                const defaultEvaluation = evaluateCode(`return (${defaultValue})`)({})
                return {
                    ...previous,
                    [key]: {
                        computed: false,
                        key,
                        value: defaultEvaluation
                    }
                }
            }, this.state)
        this.state = variableState
    }

    async fetchImportedValues() {
        const importAssetsToFetch = [...new Set(Object.values(this.normalForm)
            .filter(isNormalImport)
            .map(({ from }) => (from)))]
    
        const importAssetStates = await ephemeraDB.batchGetItem<{ State: EphemeraState; Dependencies: Record<string, EphemeraDependencies>; EphemeraId: string }>({
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
    
        console.log(`Import Asset States: ${JSON.stringify(importAssetStates, null, 4)}`)
        const importStateByAsset = (importAssetStates || [])
            .reduce<EphemeraImportState>((previous, { State: state, Dependencies: dependencies, EphemeraId }) => {
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
            }, {} as EphemeraImportState)

        this.importedStates = importStateByAsset

        const importState = Object.values(this.normalForm)
            .filter(isNormalImport)
            .reduce<EphemeraState>((previous, { from, mapping }) => {
                console.log(`From: ${from}, mapping: ${JSON.stringify(mapping, null, 4)}`)
                return Object.entries(mapping)
                    .filter(([_, { key: awayKey }]) => (awayKey in importStateByAsset[from].state))
                    .reduce<EphemeraState>((accumulator, [localKey, { key: awayKey }]) => ({
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
                    item.imported = (item.imported || []).filter(({ asset, key }) => (asset !== this.assetId || ['Variable', 'Computed'].includes(this.normalForm[key]?.tag)))
                })
                dependencyRecord.dependencies = objectFilter(dependencyRecord.dependencies, ({ imported }) => (imported.length > 0))
            })
            Object.values(this.normalForm)
                .filter(isNormalImport)
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

        const mapDependenciesByRoom = Object.values(this.normalForm)
            .filter(isNormalRoom)
            .reduce((previous, { key, appearances }) => {
                const EphemeraId = this.namespaceIdToDB[key]
                const newMapIds = appearances
                    .reduce<string[]>((accumulator, { contextStack }) => {
                        return contextStack.filter(({ tag }) => (tag === 'Map'))
                            .map(({ key }) => (this.namespaceIdToDB[key]))
                            .filter((value) => (value))
                    }, [] as string[])
                return {
                    ...previous,
                    [EphemeraId]: [...(new Set([
                        ...(previous[EphemeraId] || []),
                        ...newMapIds
                    ]))]
                }
            }, {} as Record<string, string[]>)

        const updateMapDependencyOnRoom = async ({ EphemeraId, Dependencies }: { EphemeraId: string; Dependencies: string[] }) => {
            const { Dependencies: fetchedDependencies = {} } = await ephemeraDB.getItem<{ Dependencies: EphemeraDependencies }>({
                EphemeraId,
                DataCategory: 'Meta::Room',
                ProjectionFields: ['Dependencies']
            }) || {}
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

export default StateSynthesizer

import { produce } from 'immer'

import {
    assetDB,
    ephemeraDB,
    mergeIntoDataRange
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'
import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'
import parseWMLFile from './parseWMLFile.js'
import globalizeDBEntries from "./globalize.js"
import initializeRooms from './initializeRooms.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

export const fetchAssetMetaData = async (assetId) => {
    const { fileName = '', importTree = {} } = await assetDB.getItem({
        AssetId: AssetKey(assetId),
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['fileName', 'importTree']
    })
    return { fileName, importTree }
}

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const pushMetaData = async ({ assetId, state, dependencies, actions, importTree }) => {
    await ephemeraDB.putItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::Asset',
        State: state || {},
        Dependencies: dependencies || {
            room: [],
            computed: []
        },
        Actions: actions || {},
        importTree: importTree || {}
    })
}

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

const mapContentsToExits = (normalForm) => ({ contents, ...rest }) => ({
    ...rest,
    exits: contents.reduce((previous, { tag, key }) => {
        if (tag === 'Exit') {
            return [
                ...previous,
                {
                    to: normalForm[key].toEphemeraId,
                    name: normalForm[key].name
                }
            ]
        }
        return previous
    }, [])
})

const mergeEntries = async (assetId, normalForm) => {
    const mergeEntries = Object.values(normalForm)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .map(({ appearances, ...rest }) => ({
            ...rest,
            appearances: appearances
                .map(mapContextStackToConditions(normalForm))
                .map(mapContentsToExits(normalForm))
                .map(({ conditions, name, render, exits }) => ({
                    conditions,
                    name,
                    render,
                    exits
                }))
        }))
    await Promise.all([
        mergeIntoDataRange({
            table: 'ephemera',
            search: { DataCategory: AssetKey(assetId) },
            items: mergeEntries,
            mergeFunction: ({ current, incoming }) => {
                if (!incoming) {
                    return 'delete'
                }
                if (!current) {
                    return incoming
                }
                if (compareEntries(current, incoming)) {
                    return 'ignore'
                }
                else {
                    return incoming
                }
            }
        })
    ])
}

export const cacheAsset = async (assetId) => {
    const { fileName, importTree } = await fetchAssetMetaData(assetId)
    const firstPassNormal = await parseWMLFile(fileName)
    const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)

    const [{ State: currentState = {} } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        mergeEntries(assetId, secondPassNormal),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])

    const computeDependencies = Object.values(secondPassNormal)
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

    const dependencies = Object.values(secondPassNormal)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances
                .map(mapContextStackToConditions(secondPassNormal))
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

    const variableState = Object.values(secondPassNormal)
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

    
    //
    // TODO: Import states from all dependency assets, and use that to discern
    // which imports are variables (as opposed to, for instance, rooms)
    //
    const importAssetsToFetch = [...new Set(Object.values(secondPassNormal)
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

    const updateAssetDependencies = produce(importStateByAsset, (draft) => {
        Object.values(secondPassNormal)
            .filter(({ tag }) => (tag === 'Import'))
            .filter(({ from }) => (from in importStateByAsset))
            .forEach(({ from, mapping }) => {
                if (draft[from]) {
                    if (!draft[from].dependencies) {
                        draft[from].dependencies = {}
                    }
                    Object.entries(mapping).forEach(([localKey, awayKey]) => {
                        if (awayKey in importStateByAsset[from].state) {
                            if (!(awayKey in draft[from].dependencies)) {
                                draft[from].dependencies[awayKey] = {}
                            }
                            if (!('imported' in draft[from].dependencies[awayKey])) {
                                draft[from].dependencies[awayKey].imported = []
                            }
                            draft[from].dependencies[awayKey].imported = [
                                ...((draft[from].dependencies[awayKey].computed || []).filter(({ asset, key }) => (asset !== assetId || key !== localKey))),
                                {
                                    asset: assetId,
                                    key: localKey
                                }
                            ]
                        }
                    })
                }
            })
    })

    const importState = Object.values(secondPassNormal)
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

    const uncomputedState = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), importState)

    const { state } = recalculateComputes(
        uncomputedState,
        dependencies,
        Object.entries(importState)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )

    const actions = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await Promise.all([
        pushMetaData({
            assetId,
            state,
            dependencies,
            actions,
            importTree
        }),
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
        )
    ])
}

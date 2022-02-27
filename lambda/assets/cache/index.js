import { produce } from 'immer'

import {
    ephemeraDB
} from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'
import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'
import parseWMLFile from './parseWMLFile.js'
import globalizeDBEntries from "./globalize.js"
import initializeRooms from './initializeRooms.js'
import AssetMetaData from './assetMetaData.js'
import mergeEntries from './mergeEntries.js'
import StateSynthesizer, { extractStartingState } from './stateSynthesis.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

export const cacheAsset = async (assetId, options = {}) => {
    const { check = false, recursive = false, forceCache = false } = options

    const assetMetaData = new AssetMetaData(assetId)
    if (check) {
        const alreadyPresent = await assetMetaData.checkEphemera()
        if (alreadyPresent) {
            return
        }
    }
    const { fileName, importTree, instance } = await assetMetaData.fetch()
    //
    // Instanced stories are not directly cached, they are instantiated ... so
    // this would be a miscall, and should be ignored.
    //
    if (instance) {
        return
    }
    if (recursive) {
        await Promise.all(Object.keys(importTree || {}).map((assetId) => (cacheAsset(assetId, { recursive: true, check: !forceCache }))))
    }
    const firstPassNormal = await parseWMLFile(fileName)
    const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)

    const stateSynthesizer = new StateSynthesizer(assetId, secondPassNormal)

    await Promise.all([
        stateSynthesizer.fetchFromEphemera(),
        mergeEntries(assetId, secondPassNormal),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])

    assetMetaData.dependencies = stateSynthesizer.dependencies
    
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

    const uncomputedState = await extractStartingState(secondPassNormal, stateSynthesizer.state)
    const { state } = recalculateComputes(
        uncomputedState,
        assetMetaData.dependencies,
        Object.entries(uncomputedState)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )
    assetMetaData.state = state

    assetMetaData.actions = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await Promise.all([
        assetMetaData.pushEphemera(),
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

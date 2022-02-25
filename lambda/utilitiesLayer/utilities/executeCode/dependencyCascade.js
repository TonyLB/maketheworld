import { produce } from 'immer'

import { ephemeraDB } from '../dynamoDB/index.js'
import recalculateComputes from './recalculateComputes.js'
import sortImportTree from './sortImportTree.js'
import { splitType, AssetKey } from '../types.js'

export const dependencyCascade = async (assetsMeta, assetValuesChanged, assetsAlreadyEvaluated = []) => {
    const aggregateImportTree = Object.entries(assetsMeta)
        .reduce((previous, [key, { importTree }]) => ({ ...previous, [key]: { type: 'Asset', tree: importTree } }), {})
    const orderOfEvaluation = sortImportTree(aggregateImportTree)
        .filter((key) => (!assetsAlreadyEvaluated.includes(key)))
        .filter((key) => ((key in assetsMeta) && (key in assetValuesChanged)))
    if (orderOfEvaluation.length) {
        const {
            assetsMeta: newAssetsMeta,
            assetValuesChanged: newAssetValuesChanged,
            assetsAlreadyEvaluated: newAssetsAlreadyEvaluated
        } = await produce({ assetsMeta, assetValuesChanged, assetsAlreadyEvaluated }, async (draft) => {
            const currentKey = orderOfEvaluation[0]
            const { State: state, Dependencies: dependencies } = assetsMeta[currentKey]
            const { state: newState, recalculated: newRecalculated } = recalculateComputes(
                state,
                dependencies,
                assetValuesChanged[currentKey]
            )
            draft.assetsMeta[currentKey].State = newState
            draft.assetValuesChanged[currentKey] = newRecalculated
            draft.assetsAlreadyEvaluated.push(currentKey)

            //
            // Now that we've calculated all the changes in this asset, we need to cascade those
            // changes to anywhere that they impact
            //
            const exportedValues = Object.entries(draft.assetsMeta[currentKey].Dependencies)
                .filter(([key]) => (draft.assetValuesChanged[currentKey].includes(key)))
                .reduce((previous, [key, { imported = [] }]) => ([
                    ...previous,
                    ...(imported.map(({ asset, key: awayKey }) => ({ localKey: key, asset, awayKey })))
                ]), [])

            //
            // First, fetch any other assets that we are updating for the first time
            //
            const unmappedAssets = [...(new Set(exportedValues
                .map(({ asset }) => (asset))
                .filter((asset) => (!(asset in draft.assetsMeta)))
            ))]
            const metaFetched = await ephemeraDB.batchGetItem({
                Items: unmappedAssets
                    .map((asset) => ({
                        EphemeraId: AssetKey(asset),
                        DataCategory: 'Meta::Asset'
                    })),
                ProjectionFields: ['EphemeraId', '#state', 'Dependencies', 'importTree'],
                ExpressionAttributeNames: {
                    '#state': 'State'
                }
            })
            metaFetched
                .filter((value) => (value))
                .forEach(({ EphemeraId, ...rest }) => {
                    draft.assetsMeta[splitType(EphemeraId)[1]] = rest
                })

            //
            // Next, update all the states
            //
            exportedValues
                .forEach(({ asset, awayKey, localKey }) => {
                    if (draft.assetsMeta[asset].State[awayKey]) {
                        draft.assetsMeta[asset].State[awayKey].value = newState[localKey]?.value
                        if (!(asset in draft.assetValuesChanged)) {
                            draft.assetValuesChanged[asset] = []
                        }
                        draft.assetValuesChanged[asset] = [
                            ...(draft.assetValuesChanged[asset].filter((key) => (key !== awayKey))),
                            awayKey
                        ]
                    }
                })
        })
        return dependencyCascade(newAssetsMeta, newAssetValuesChanged, newAssetsAlreadyEvaluated)
    }
    else {
        return {
            states: assetsMeta,
            recalculated: Object.entries(assetValuesChanged)
                .reduce((previous, [assetId, keys]) => ({
                    ...previous,
                    [assetId]: [
                        ...(previous[assetId] || []),
                        ...keys
                    ]
                }), {})
        }    
    }
}

export default dependencyCascade

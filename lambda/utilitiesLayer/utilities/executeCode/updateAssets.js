import { ephemeraDB } from '../dynamoDB/index.js'
import { AssetKey } from '../types.js'
import { assetRender } from '../perception/assetRender.js'

const updateSingleAsset = async({ assetId, newStates, recalculated }) => {

    const mapCacheDependencies = (recalculated
        .map((recalculatedKey) => (Object.keys(newStates[assetId]?.Dependencies?.[recalculatedKey]?.mapCache || []).length > 0))
        .filter((value) => (value))).length > 0
    if (mapCacheDependencies) {
        const renderedAsset = await assetRender({
            assetId,
            existingStatesByAsset: newStates
        })
        await ephemeraDB.update({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state, mapCache = :mapCache',
            ExpressionAttributeNames: {
                '#state': 'State'
            },
            ExpressionAttributeValues: {
                [':state']: newStates[assetId]?.State || {},
                [':mapCache']: renderedAsset
            }
        })
    }
    else {
        await ephemeraDB.update({
            EphemeraId: AssetKey(assetId),
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                '#state': 'State'
            },
            ExpressionAttributeValues: {
                ':state': newStates[assetId]?.State || {}
            }
        })
    }
}

export const updateAssets = async ({ newStates, recalculated }) => {

    await Promise.all(Object.keys(newStates)
        .map((assetId) => (updateSingleAsset({ assetId, newStates, recalculated: recalculated[assetId] || [] })))
    )

}

export default updateAssets

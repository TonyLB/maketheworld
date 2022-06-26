import { ephemeraDB } from '../dynamoDB'
import { AssetKey } from '../types'
import { assetRender } from '../perception/assetRender'

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
        return {
            [assetId]: {
                ...(newStates[assetId] || {}),
                mapCache: renderedAsset
            }
        }
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
        return {}
    }
}

export const updateAssets = async ({ newStates, recalculated }) => {

    const updates = await Promise.all(Object.keys(newStates)
        .map((assetId) => (updateSingleAsset({ assetId, newStates, recalculated: recalculated[assetId] || [] })))
    )

    return Object.assign({ ...newStates }, ...updates)
}

export default updateAssets

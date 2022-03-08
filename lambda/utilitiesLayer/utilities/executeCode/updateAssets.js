import { ephemeraDB } from '../dynamoDB/index.js'
import { AssetKey } from '../types.js'

export const updateAssets = async ({ newStates, recalculated }) => {
    //
    // TODO: Run assetRender against all assets needing MapCache and use the
    // results to update their mapCache entries
    //

    await Promise.all(Object.entries(newStates)
        .map(([key, newState]) => (
            ephemeraDB.update({
                EphemeraId: AssetKey(key),
                DataCategory: 'Meta::Asset',
                UpdateExpression: 'SET #state = :state',
                ExpressionAttributeNames: {
                    '#state': 'State'
                },
                ExpressionAttributeValues: {
                    ':state': newState.State
                }
            })    
        ))
    )

}

export default updateAssets

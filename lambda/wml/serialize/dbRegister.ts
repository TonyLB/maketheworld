import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { graphCache, graphStorageDB } from './graphCache'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists'

const { FEEDBACK_TOPIC } = process.env

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const standard = assetWorkspace.standard
    if (standard) {
        const assetKey = address.zone === 'Draft' ? `${standard.key}[${address.player}]` : standard.key
        const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
        const allImportAssetIds = unique(
            standard._components
                .map((component) => (component._from))
                .filter(excludeUndefined)
        )
        graphUpdate.setEdges([{
            itemId: AssetKey(assetKey),
            edges: allImportAssetIds.map((from) => ({ target: AssetKey(from), context: '' })),
            options: { direction: 'back' }
        }])
        await Promise.all([
            graphUpdate.flush(),
            assetDB.putItem({
                AssetId: AssetKey(assetKey),
                DataCategory: `Meta::Asset`,
                address,
                Story: undefined,
                instance: undefined,
                zone: address.zone,
                ...((address.zone === 'Draft' || address.zone === 'Personal') ? { player: address.player } : {})
            })
        ])
    }

}

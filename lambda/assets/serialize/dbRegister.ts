import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import internalCache from '../internalCache'
import { graphStorageDB } from './graphCache'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { isSchemaImport } from '@tonylb/mtw-base/ts/schema/metaData'
import eventBridgeClient from '@tonylb/mtw-utilities/ts/eventBridge'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const standardForm = assetWorkspace.standard
    if (!standardForm) {
        return
    }
    const { key } = standardForm
    const checkBefore = await assetDB.getItem({
        Key: {
            AssetId: AssetKey(key),
            DataCategory: `Meta::Asset`
        },
        ProjectionFields: ['AssetId']
    })
    const updatedLibraryAssets = {
        [AssetKey(key)]: {
            AssetId: AssetKey(key),
            scopedId: key
        }
    }
    const updatedPlayerAssets = {
        [key]: {
            AssetId: key,
            scopedId: key
        }
    }
    const updateLibraryPromise = address.zone === 'Personal'
        ? internalCache.PlayerLibrary.set(address.player, {
            Assets: updatedPlayerAssets,
            Characters: {}
        })
        : address.zone === 'Library'
            ? internalCache.Library.set({
                Assets: updatedLibraryAssets,
                Characters: {}
            })
            : Promise.resolve({})
    const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })
    graphUpdate.setEdges([{
        itemId: AssetKey(key),
        edges: standardForm.metaData
            .filter(treeNodeTypeguard(isSchemaImport))
            .map(({ data }) => ({ target: AssetKey(data.from), context: '' })),
        options: { direction: 'back' }
    }])
    const [prior] = await Promise.all([
        checkBefore,
        graphUpdate.flush(),
        assetDB.putItem({
            AssetId: AssetKey(key),
            DataCategory: `Meta::Asset`,
            address,
            zone: address.zone,
            ...(address.zone === 'Personal' ? { player: address.player } : {})
        }),
        updateLibraryPromise
    ])
    if (!(prior && prior.AssetId)) {
        await eventBridgeClient.send([{
            Source: 'mtw.assets',
            DetailType: 'Asset Added',
            Detail: {
                assetId: AssetKey(key),
                zone: address.zone,
                wml: schemaToWML([standardForm.schema])
            }
        }])
    }

}

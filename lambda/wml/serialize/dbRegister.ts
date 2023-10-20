import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { isNormalAsset, NormalForm, isNormalCharacter, isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { graphCache, graphStorageDB } from './graphCache'
import { CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'
import { snsClient } from '../clients'
import { PublishCommand } from '@aws-sdk/client-sns'

const { FEEDBACK_TOPIC } = process.env

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const assets: NormalForm = assetWorkspace.normal || {}
    const asset = Object.values(assets).find(isNormalAsset)
    if (asset && asset.key) {
        const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
        graphUpdate.setEdges([{
            itemId: AssetKey(asset.key),
            edges: Object.values(assets)
                .filter(isNormalImport)
                .map(({ from }) => ({ target: AssetKey(from), context: '' })),
            options: { direction: 'back' }
        }])
        await Promise.all([
            graphUpdate.flush(),
            assetDB.putItem({
                AssetId: AssetKey(asset.key),
                DataCategory: `Meta::Asset`,
                address,
                Story: asset.Story,
                instance: asset.instance,
                zone: address.zone,
                ...(address.zone === 'Personal' ? { player: address.player } : {})
            })
        ])
    }
    const character = Object.values(assets).find(isNormalCharacter)
    if (character && character.key) {
        const universalKey = assetWorkspace.universalKey(character.key)
        if (!universalKey) {
            return
        }
        const images = (character.images || [])
            .map((image) => (assetWorkspace.properties[image]?.fileName))
            .filter((image) => (image))
        const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
        graphUpdate.setEdges([{
            itemId: CharacterKey(character.key),
            edges: Object.values(assets)
                .filter(isNormalImport)
                .map(({ from }) => ({ target: AssetKey(from), context: '' })),
            options: { direction: 'back' }
        }])
        await Promise.all([
            graphUpdate.flush(),
            assetDB.putItem({
                AssetId: universalKey,
                DataCategory: `Meta::Character`,
                address,
                zone: address.zone,
                Name: character.Name,
                FirstImpression: character.FirstImpression,
                OneCoolThing: character.OneCoolThing,
                Pronouns: character.Pronouns,
                Outfit: character.Outfit,
                images,
                scopedId: character.key,
                ...(address.zone === 'Personal' ? { player: address.player } : {})
            })
        ])
        if (address.zone === 'Personal') {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({ player: address.player }),
                MessageAttributes: {
                    Type: { DataType: 'String', StringValue: 'PlayerInfo' }
                }
            }))
        }
        if (address.zone === 'Library') {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: '{}',
                MessageAttributes: {
                    Type: { DataType: 'String', StringValue: 'LibraryUpdate' }
                }
            }))
        }
    }

}

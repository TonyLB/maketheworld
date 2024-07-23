import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { graphCache, graphStorageDB } from './graphCache'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { snsClient } from '../clients'
import { PublishCommand } from '@aws-sdk/client-sns'
import { isSchemaImport } from '@tonylb/mtw-wml/ts/schema/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'

const { FEEDBACK_TOPIC } = process.env

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const standard = assetWorkspace.standard
    if (standard) {
        if (standard.tag === 'Asset') {
            const assetKey = address.zone === 'Draft' ? `${standard.key}[${address.player}]` : standard.key
            const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
            graphUpdate.setEdges([{
                itemId: AssetKey(assetKey),
                edges: standard.metaData
                    .map(({ data }) => (data))
                    .filter(isSchemaImport)
                    .map(({ from }) => ({ target: AssetKey(from), context: '' })),
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
        if (standard.tag === 'Character') {
            const character = standard.byId[standard.key]
            if (!(character && character.tag === 'Character')) {
                throw new Error('Character info mismatch in dbRegister')
            }
            const universalKey = assetWorkspace.universalKey(character.key)
            if (!universalKey) {
                return
            }
            const fileURL = (assetWorkspace.properties[character.image.data.key]?.fileName ?? '')
            const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
            graphUpdate.setEdges([{
                itemId: universalKey,
                edges: standard.metaData
                    .map(({ data }) => (data))
                    .filter(isSchemaImport)
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
                    Name: schemaOutputToString(character.name.children),
                    FirstImpression: character.firstImpression.data.value,
                    OneCoolThing: character.oneCoolThing.data.value,
                    Pronouns: character.pronouns,
                    Outfit: character.outfit.data.value,
                    fileURL,
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

}

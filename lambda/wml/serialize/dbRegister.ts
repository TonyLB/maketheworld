import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { graphCache, graphStorageDB } from './graphCache'
import { CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'
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
            const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
            graphUpdate.setEdges([{
                itemId: AssetKey(standard.key),
                edges: standard.metaData
                    .map(({ data }) => (data))
                    .filter(isSchemaImport)
                    .map(({ from }) => ({ target: AssetKey(from), context: '' })),
                options: { direction: 'back' }
            }])
            await Promise.all([
                graphUpdate.flush(),
                assetDB.putItem({
                    AssetId: AssetKey(standard.key),
                    DataCategory: `Meta::Asset`,
                    address,
                    Story: undefined,
                    instance: undefined,
                    zone: address.zone,
                    ...(address.zone === 'Personal' ? { player: address.player } : {})
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
            //
            // TODO: Add images to serializableStandardCharacter
            //
            // const images = (character.images || [])
            //     .map((image) => (assetWorkspace.properties[image]?.fileName))
            //     .filter((image) => (image))
            const graphUpdate = new GraphUpdate({ internalCache: graphCache, dbHandler: graphStorageDB })
            graphUpdate.setEdges([{
                itemId: CharacterKey(character.key),
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
                    image: character.image.data.key,
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

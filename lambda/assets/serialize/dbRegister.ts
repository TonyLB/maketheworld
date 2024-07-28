import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { graphStorageDB } from './graphCache'
import { CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'
import { isSchemaImport } from '@tonylb/mtw-wml/ts/schema/baseClasses'
import { treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const standardForm = assetWorkspace.standard
    if (!standardForm) {
        return
    }
    if (standardForm.tag === 'Asset') {
        const { key } = standardForm
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
        await Promise.all([
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
    }
    if (standardForm.tag === 'Character') {
        const character = standardForm.byId[standardForm.key]
        if (!(character && character.tag === 'Character')) {
            return
        }
        const Name = schemaOutputToString(character.name.children)
        const universalKey = assetWorkspace.universalKey(character.key) as EphemeraCharacterId
        if (!universalKey) {
            return
        }
        const images = [character.image]
            .map((image) => (assetWorkspace.properties[image.data.key]?.fileName))
            .filter((image) => (image))
        const updatedCharacters = {
            [universalKey]: {
                CharacterId: universalKey,
                Name,
                fileName: '',
                fileURL: images[0] || undefined,
                scopedId: character.key,        
            }
        }
        const updateLibraryPromise = address.zone === 'Personal'
            ? internalCache.PlayerLibrary.set(address.player, {
                Assets: {},
                Characters: updatedCharacters
            })
            : address.zone === 'Library'
                ? internalCache.Library.set({
                    Assets: {},
                    Characters: updatedCharacters
                })
                : Promise.resolve({})
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })
        graphUpdate.setEdges([{
            itemId: CharacterKey(character.key),
            edges: standardForm.metaData
                .filter(treeNodeTypeguard(isSchemaImport))
                .map(({ data }) => ({ target: AssetKey(data.from), context: '' })),
            options: { direction: 'back' }
        }])
        await Promise.all([
            graphUpdate.flush(),
            assetDB.putItem({
                AssetId: universalKey,
                DataCategory: `Meta::Character`,
                address,
                zone: address.zone,
                Name,
                images,
                scopedId: character.key,
                ...(address.zone === 'Personal' ? { player: address.player } : {})
            }),
            updateLibraryPromise
        ])
        if (address.zone === 'Personal') {
            messageBus.send({
                type: 'PlayerInfo',
                player: address.player
            })

        }
        if (address.zone === 'Library') {
            messageBus.send({ type: 'LibraryUpdate' })
        }
    }

}

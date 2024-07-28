import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { isNormalAsset, NormalForm, isNormalCharacter, isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { graphStorageDB } from './graphCache'
import { CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'
import Normalizer from '@tonylb/mtw-wml/ts/normalize'
import { selectNameAsString } from '@tonylb/mtw-wml/ts/schema/selectors/name'

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    const assets: NormalForm = assetWorkspace.normal || {}
    const asset = Object.values(assets).find(isNormalAsset)
    if (asset && asset.key) {
        const updatedLibraryAssets = {
            [AssetKey(asset.key)]: {
                AssetId: AssetKey(asset.key),
                scopedId: asset.key,
                Story: asset.Story,
                instance: asset.instance,
            }
        }
        const updatedPlayerAssets = {
            [asset.key]: {
                AssetId: asset.key,
                scopedId: asset.key,
                Story: asset.Story,
                instance: asset.instance,
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
            }),
            updateLibraryPromise
        ])
    }
    const character = Object.values(assets).find(isNormalCharacter)
    if (character && character.key) {
        const normalizer = new Normalizer()
        normalizer.loadNormal(assets)
        const Name = normalizer.select({ key: character.key, selector: selectNameAsString })
        const universalKey = assetWorkspace.universalKey(character.key) as EphemeraCharacterId
        if (!universalKey) {
            return
        }
        const images = (character.images || [])
            .map((image) => (assetWorkspace.properties[image]?.fileName))
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

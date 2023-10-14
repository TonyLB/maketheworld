import { v4 as uuidv4 } from 'uuid'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { isNormalAsset, isNormalComponent, isNormalExit, NormalForm, isNormalCharacter, NormalItem, isNormalMap, isNormalRoom, isNormalFeature, NormalReference, isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { EphemeraCharacterId, EphemeraError } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { graphStorageDB } from './graphCache'
import { CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'

const tagRenderLink = (normalForm) => (renderItem) => {
    if (typeof renderItem === 'object') {
        if (renderItem.tag === 'Link') {
            return {
                ...renderItem,
                targetTag: normalForm[renderItem.to]?.tag
            }
        }
    }
    return renderItem
}

const denormalizeExits = (normalForm: NormalForm) => (contents: NormalReference[]) => {
    const exitTags = contents.filter(({ tag }) => (tag === 'Exit'))
    const exits = exitTags.map(({ key }) => (normalForm[key])).filter(isNormalExit)
    return exits.map(({ name, to }) => ({ name, to }))
}

const noConditionContext = ({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If')))

const itemRegistry = (normalForm: NormalForm) => (item: NormalItem) => {
    if (isNormalMap(item)) {
        const mapDefaultAppearances = item.appearances
            .filter(noConditionContext)
            .map(({ rooms }) => ({
                rooms: rooms.map(({ key, ...rest }) => {
                    const lookup = normalForm[key]
                    if (!isNormalRoom(lookup)) {
                        throw new EphemeraError(`Invalid item in map room lookup: ${key}`)
                    }
                    return {
                        ...rest,
                        name: (lookup.appearances || [])
                            .filter(noConditionContext)
                            .map<string>(({ name }) => ((name || []).map((namePart) => (namePart.tag === 'String' ? namePart.value : '')).join('')))
                            .join('')
                    }
                })
            }))
        return {
            tag: item.tag,
            key: item.key,
            defaultAppearances: mapDefaultAppearances
        }
    }
    if (isNormalRoom(item)) {
        return {
            tag: item.tag,
            key: item.key,
            defaultAppearances: item.appearances
                .filter(noConditionContext)
                .filter(({ contents= [], render = [], name = [] }) => (contents.length > 0 || render.length > 0 || name.length > 0))
                .map(({ contents = [], render = [], name = [] }) => ({
                    exits: denormalizeExits(normalForm)(contents),
                    render: render.map(tagRenderLink(normalForm)),
                    name: name.map((item) => (item.tag === 'String' ? item.value : '')).join('')
                }))
        }
    }
    if (isNormalFeature(item)) {
        return {
            tag: item.tag,
            key: item.key,
            defaultAppearances: item.appearances
                .filter(noConditionContext)
                .filter(({ contents= [], render = [], name = [] }) => (contents.length > 0 || render.length > 0 || name.length > 0))
                .map(({ render, name = [] }) => ({
                    render: (render || []).map(tagRenderLink(normalForm)),
                    name: name.map((item) => (item.tag === 'String' ? item.value : '')).join('')
                }))
        }
    }
}

export const dbRegister = async (assetWorkspace: ReadOnlyAssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    // if (assetWorkspace.status.json !== 'Clean') {
    //     await assetWorkspace.loadJSON()
    // }
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
        const images = (character.images || [])
            .map((image) => (assetWorkspace.properties[image]?.fileName))
            .filter((image) => (image))
        const updatedCharacters = {
            [assetWorkspace.namespaceIdToDB[character.key]]: {
                CharacterId: assetWorkspace.namespaceIdToDB[character.key] as EphemeraCharacterId,
                Name: character.Name,
                FirstImpression: character.FirstImpression,
                OneCoolThing: character.OneCoolThing,
                Pronouns: character.Pronouns,
                Outfit: character.Outfit,
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
                AssetId: assetWorkspace.namespaceIdToDB[character.key],
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

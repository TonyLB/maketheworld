import { v4 as uuidv4 } from 'uuid'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types.js'
import AssetWorkspace from '@tonylb/mtw-asset-workspace/dist/index.js'
import { isNormalAsset, isNormalComponent, isNormalExit, NormalForm, isNormalCharacter, NormalItem, isNormalMap, isNormalRoom, isNormalFeature, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { EphemeraCharacterId, EphemeraError } from '@tonylb/mtw-interfaces/dist/baseClasses.js'
import internalCache from '../internalCache'
import messageBus from '../messageBus'

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

export const dbRegister = async (assetWorkspace: AssetWorkspace): Promise<void> => {
    const { address } = assetWorkspace
    // if (assetWorkspace.status.json !== 'Clean') {
    //     await assetWorkspace.loadJSON()
    // }
    const assets: NormalForm = assetWorkspace.normal || {}
    const asset = Object.values(assets).find(isNormalAsset)
    if (asset && asset.key) {
        const defaultExits = Object.values(assets)
            .filter(isNormalExit)
            .filter(({ appearances }) => ((appearances || []).find(noConditionContext)))
            .map(({ name, to, from }) => ({ name, to, from }))
        const defaultNames = Object.values(assets)
            .filter(isNormalComponent)
            .map(({ tag, key, appearances }) => ({
                tag,
                key,
                name: (appearances || [])
                    .filter(noConditionContext)
                    .map(({ name = [] }) => (name.map((item) => (item.tag === 'String' ? item.value : '')).join('')))
                    .join('')
            }))
            .filter(({ name }) => (Boolean(name)))
            .map(({ tag, key, name }) => ({ [key]: { tag, name } }))
            .reduce((previous, entry) => (Object.assign(previous, entry)), {})
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
        await Promise.all([
            assetDB.putItem({
                AssetId: AssetKey(asset.key),
                DataCategory: `Meta::Asset`,
                address,
                Story: asset.Story,
                instance: asset.instance,
                importTree: [],
                defaultExits,
                defaultNames,
                zone: address.zone,
                ...(address.zone === 'Personal' ? { player: address.player } : {})
            }),
            assetDB.merge({
                query: {
                    IndexName: 'DataCategoryIndex',
                    Key: {
                        DataCategory: AssetKey(asset.key)
                    }
                },
                items: asset.instance
                    ? []
                    : Object.values(assets)
                        .filter(({ tag }) => (['Room', 'Feature', 'Map'].includes(tag)))
                        .map(itemRegistry(assets)) as any,
                mergeFunction: ({ current, incoming }) => {
                    if (!incoming) {
                        return 'delete'
                    }
                    if (!current || (JSON.stringify(current) !== JSON.stringify(incoming))) {
                        const { tag, key, ...rest } = incoming
                        return {
                            scopedId: key,
                            ...rest
                        }
                    }

                    return 'ignore'
                },
                extractKey: ({ tag, key }) => {
                    let prefix = ''
                    switch(tag) {
                        case 'Feature':
                        case 'Map':
                        case 'Bookmark':
                        case 'Message':
                        case 'Moment':
                            prefix = tag.toUpperCase()
                            break
                        default:
                            prefix = 'ROOM'
                    }
                    if (assetWorkspace._isGlobal) {
                        return `${prefix}#${key}`
                    }
                    if (assetWorkspace.namespaceIdToDB[key]) {
                        return assetWorkspace.namespaceIdToDB[key]
                    }
                    console.log(`ERROR:  ScopeMap in dbRegister has no entry for ${key}`)
                    return `${prefix}#${uuidv4()}`
                }
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
        await Promise.all([
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

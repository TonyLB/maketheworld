import { v4 as uuidv4 } from 'uuid'
import { assetDB, mergeIntoDataRange } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { AssetKey } from '@tonylb/mtw-utilities/dist/types'
import AssetWorkspace from '@tonylb/mtw-asset-workspace/dist/index.js'
import { isNormalAsset, isNormalComponent, isNormalExit, NormalForm, isNormalCharacter, NormalItem, isNormalMap, isNormalRoom, isNormalFeature, NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses.js'
import { EphemeraError } from '@tonylb/mtw-interfaces/dist/baseClasses.js'

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
                rooms: rooms.map(({ key, location, ...rest }) => {
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
    if (assetWorkspace.status.json !== 'Clean') {
        await assetWorkspace.loadJSON()
    }
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
        await Promise.all([
            assetDB.putItem({
                AssetId: AssetKey(asset.key),
                DataCategory: `Meta::Asset`,
                fileName: address.fileName,
                zone: address.zone,
                subFolder: address.subFolder,
                player: address.zone === 'Personal' ? address.player : undefined,
                Story: asset.Story,
                instance: asset.instance,
                importTree: [],
                defaultExits,
                defaultNames
            }),
            mergeIntoDataRange({
                table: 'assets',
                search: { DataCategory: AssetKey(asset.key) },
                items: asset.instance
                    ? []
                    : Object.values(assets)
                        .filter(({ tag }) => (['Room', 'Feature', 'Map', 'Bookmark', 'Message', 'Moment'].includes(tag)))
                        .map(itemRegistry(assets)),
                mergeFunction: ({ current, incoming }) => {
                    if (!incoming) {
                        return 'delete'
                    }
                    if (!current || (JSON.stringify(current) !== JSON.stringify(incoming))) {
                        const { tag, key, global, ...rest } = incoming
                        return {
                            scopedId: key,
                            ...rest
                        }
                    }

                    return 'ignore'
                },
                extractKey: ({ tag, global: isGlobal, key }) => {
                    let prefix = ''
                    switch(tag) {
                        case 'Feature':
                            prefix = 'FEATURE'
                            break
                        case 'Map':
                            prefix = 'MAP'
                            break
                        case 'Bookmark':
                            prefix = 'BOOKMARK'
                            break
                        case 'Message':
                            prefix = 'MESSAGE'
                            break
                        case 'Moment':
                            prefix = 'MOMENT'
                            break
                        default:
                            prefix = 'ROOM'
                    }
                    if (isGlobal) {
                        return `${prefix}#${key}`
                    }
                    if (assetWorkspace.namespaceIdToDB[key]) {
                        return assetWorkspace.namespaceIdToDB[key]
                    }
                    console.log(`ERROR:  ScopeMap in dbRegister has no entry for ${key}`)
                    return `${prefix}#${uuidv4()}`
                }
            })
        ])
    }
    const character = Object.values(assets).find(isNormalCharacter)
    if (character && character.key) {
        await Promise.all([
            assetDB.putItem({
                AssetId: assetWorkspace.namespaceIdToDB[character.key],
                DataCategory: `Meta::Character`,
                address,
                Name: character.Name,
                images: character.images,
                scopedId: character.key,
                ...(address.zone === 'Personal' ? { player: address.player } : {})
            })
        ])
    }

}

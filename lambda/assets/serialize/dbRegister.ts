import { v4 as uuidv4 } from 'uuid'
import { assetDB, mergeIntoDataRange } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { AssetKey, CharacterKey } from '@tonylb/mtw-utilities/dist/types'
import { componentAppearanceReduce } from '@tonylb/mtw-utilities/dist/components/components'
import AssetWorkspace from '@tonylb/mtw-asset-workspace/dist/'
import { objectEntryMap } from '../lib/objects.js'
import { isNormalAsset, isNormalComponent, isNormalExit, NormalForm } from '@tonylb/mtw-wml/dist/normalize.js'

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

const denormalizeExits = (normalForm) => (contents) => {
    const exitTags = contents.filter(({ tag }) => (tag === 'Exit'))
    const exits = exitTags.map(({ key }) => (normalForm[key]))
    return exits.map(({ name, to }) => ({ name, to }))
}

const noConditionContext = ({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition')))

const itemRegistry = (normalForm) => (item) => {
    const { tag, name, key, global: isGlobal, appearances = [] } = item
    switch(tag) {
        case 'Map':
            const mapDefaultAppearances = appearances
                .filter(noConditionContext)
                .map(({ rooms }) => ({
                    rooms: objectEntryMap(rooms, (key, { location, ...rest }) => ({
                        ...rest,
                        name: (normalForm[key]?.appearances || [])
                            .filter(noConditionContext)
                            .reduce(componentAppearanceReduce, { name: '' }).name
                    }))
                }))
            return {
                tag,
                key,
                defaultAppearances: mapDefaultAppearances
            }
        case 'Room':
            return {
                tag,
                name,
                isGlobal,
                key,
                defaultAppearances: appearances
                    .filter(noConditionContext)
                    .filter(({ contents= [], render = [], name = '' }) => (contents.length > 0 || render.length > 0 || name))
                    .map(({ contents = [], render = [], name = '' }) => ({
                        exits: denormalizeExits(normalForm)(contents),
                        render: render.map(tagRenderLink(normalForm)),
                        name
                    }))
            }
        case 'Feature':
            return {
                tag,
                name,
                isGlobal,
                key,
                defaultAppearances: appearances
                    .filter(noConditionContext)
                    .filter(({ render = [], name = '' }) => (render.length > 0 || name))
                    .map(({ render, name }) => ({
                        render: render.map(tagRenderLink(normalForm)),
                        name
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
                    .map(({ name = '' }) => name)
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
                        .filter(({ tag }) => (['Room', 'Feature', 'Map'].includes(tag)))
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
    // const character = Object.values(assets).find(({ tag }) => (tag === 'Character'))
    // if (character && character.key) {
    //     await Promise.all([
    //         assetDB.putItem({
    //             AssetId: scopeMap[character.key],
    //             DataCategory: 'Meta::Character',
    //             fileName,
    //             translateFile,
    //             scopedId: character.key,
    //             ...(['Name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'player', 'fileURL', 'zone']
    //                 .reduce((previous, label) => ({ ...previous, [label]: character[label] }), {}))
    //         })
    //     ])
    // }

}

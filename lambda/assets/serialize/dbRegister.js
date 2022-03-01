import { assetDB, mergeIntoDataRange } from '/opt/utilities/dynamoDB/index.js'
import { AssetKey } from '/opt/utilities/types.js'


export const dbRegister = async ({ fileName, translateFile, importTree, scopeMap, assets }) => {
    const asset = assets.find(({ tag }) => (['Asset'].includes(tag)))
    if (asset && asset.key) {
        await Promise.all([
            assetDB.putItem({
                AssetId: AssetKey(asset.key),
                DataCategory: `Meta::Asset`,
                Story: asset.Story,
                instance: asset.instance,
                fileName,
                translateFile,
                importTree,
                name: asset.name,
                description: asset.description,
                player: asset.player,
                zone: asset.zone
            }),
            mergeIntoDataRange({
                table: 'assets',
                search: { DataCategory: AssetKey(asset.key) },
                items: asset.instance
                    ? []
                    : assets
                        .filter(({ tag }) => (['Room', 'Feature'].includes(tag))),
                mergeFunction: ({ current, incoming }) => {
                    if (!incoming) {
                        return 'delete'
                    }
                    if (!current) {
                        const { tag, key, isGlobal, ...rest } = incoming
                        return {
                            scopedId: key,
                            ...rest
                        }
                    }
                    //
                    // TODO: When Room entries are expanded to store more than the sheer fact of their
                    // existence (likely as part of Map storage), extend this function to compensate
                    // by testing whether an update is needed
                    //
                    return 'ignore'
                },
                extractKey: ({ tag, isGlobal, key }) => {
                    let prefix = ''
                    switch(tag) {
                        case 'Feature':
                            prefix = 'FEATURE'
                            break
                        default:
                            prefix = 'ROOM'
                    }
                    if (isGlobal) {
                        return `${prefix}#${key}`
                    }
                    if (scopeMap[key]) {
                        return `${prefix}#${scopeMap[key]}`
                    }
                    console.log(`ERROR:  ScopeMap in dbRegister has no entry for ${key}`)
                    return `${prefix}#${uuidv4()}`
                }
            })
        ])
    }
    const character = assets.find(({ tag }) => (tag === 'Character'))
    if (character && character.key) {
        await Promise.all([
            assetDB.putItem({
                AssetId: `CHARACTER#${scopeMap[character.key]}`,
                DataCategory: 'Meta::Character',
                fileName,
                translateFile,
                scopedId: character.key,
                ...(['Name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'player']
                    .reduce((previous, label) => ({ ...previous, [label]: character[label] }), {}))
            })
        ])
    }

}

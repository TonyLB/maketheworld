import { replaceItem, mergeIntoDataRange } from '../utilities/dynamoDB/index.js'

export const dbRegister = async (dbClient, { fileName, translateFile, importTree, scopeMap, assets }) => {
    const asset = assets.find(({ tag }) => (tag === 'Asset'))
    if (asset && asset.key) {
        await Promise.all([
            replaceItem(dbClient, {
                AssetId: `ASSET#${asset.key}`,
                DataCategory: 'Meta::Asset',
                fileName,
                translateFile,
                importTree,
                name: asset.name,
                description: asset.description,
                player: asset.player,
                zone: asset.zone
            }),
            mergeIntoDataRange({
                dbClient,
                table: 'assets',
                search: { DataCategory: `ASSET#${asset.key}` },
                items: assets
                    .filter(({ tag }) => (tag === 'Room'))
                    .map(({ tag, ...rest }) => (rest)),
                mergeFunction: ({ current, incoming }) => {
                    if (!incoming) {
                        return 'delete'
                    }
                    if (!current) {
                        const { key, isGlobal, ...rest } = incoming
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
                extractKey: (item) => {
                    if (item.isGlobal) {
                        return `ROOM#${item.key}`
                    }
                    if (scopeMap[item.key]) {
                        return `ROOM#${scopeMap[item.key]}`
                    }
                    console.log(`ERROR:  ScopeMap in dbRegister has no entry for ${item.key}`)
                    return `ROOM#${uuidv4()}`
                }
            })
        ])
    }
    const character = assets.find(({ tag }) => (tag === 'Character'))
    if (character && character.key) {
        await Promise.all([
            replaceItem(dbClient, {
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

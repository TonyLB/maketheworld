import { SchemaTag, isSchemaConditionStatement, isSchemaCondition, isSchemaConditionFallthrough, isImportable, SchemaWithKey, isSchemaImport } from "../schema/baseClasses"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../tree/baseClasses"
import { StandardComponentData } from "./baseClasses"
import { StandardizerAbstract } from './abstract'
import { excludeUndefined } from "../lib/lists"
import { StandardFormData } from "./components/dataTypes"
import { unique } from "../list"
import SchemaTagTree from "../tagTree/schema"
import { TagListItem, TagTreeMatchOperation } from "../tagTree"
import applyEdits from "../schema/treeManipulation/applyEdits"

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value) => value is G): G => {
    if (typeguard(value)) {
        return value
    }
    throw new Error('Type mismatch')
}

export const defaultSelected = <Extra extends {}>(tree: GenericTree<SchemaTag, Extra>): GenericTree<SchemaTag, Extra> => (
    tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node)) {
            const indexOfFirstSelected = node.children.findIndex(({ data }) => ((isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)) && (data.selected ?? false) ))
            if (indexOfFirstSelected !== -1) {
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === indexOfFirstSelected ? true : undefined } }
                            : child
                    )))
                }
            }
            else {
                const fallThroughIndex = node.children.findIndex(treeNodeTypeguard(isSchemaConditionFallthrough))
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === fallThroughIndex } }
                            : child
                    )))
                }
            }
        }
        return {
            ...node,
            children: defaultSelected(node.children)
        }
    })
)

export const standardItemToSchemaItem = (item: StandardComponentData): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const { tag, ...pronouns } = item.pronouns?.data ?? { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
            return {
                data: { tag: 'Character', key: item.key, Pronouns: 'subject' in pronouns ? pronouns : { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                children: [
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit].filter(excludeUndefined),
                ]
            }
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                children: defaultSelected([
                    ...[item.shortName, item.name, item.summary, item.description].filter(excludeUndefined),
                    ...item.exits
                ])
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: defaultSelected([item.name, item.description].filter(excludeUndefined))
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: defaultSelected(item.description?.children ?? [])
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                children: [
                    ...item.rooms,
                    ...item.description?.children ?? []
                ]
            }
        case 'Moment':
            return {
                data: { tag: 'Moment', key: item.key },
                children: item.messages
            }
        case 'Map':
            return {
                data: { tag: 'Map', key: item.key },
                children: defaultSelected([
                    item.name,
                    ...item.images,
                    ...item.positions
                ].filter(excludeUndefined))
            }
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                children: [
                    item.name,
                    ...item.rooms,
                    ...item.maps
                ].filter(excludeUndefined)
            }
        case 'Variable':
            return {
                data: { tag: 'Variable', key: item.key, default: item.default },
                children: []
            }
        case 'Computed':
            return {
                data: { tag: item.tag, key: item.key, src: item.src, dependencies: item.dependencies },
                children: []
            }
        case 'Action':
            return {
                data: { tag: item.tag, key: item.key, src: item.src },
                children: []
            }
        case 'Image':
            return {
                data: { tag: item.tag, key: item.key },
                children: []
            }
        case 'Remove':
            return {
                data: { tag: item.tag },
                children: [standardItemToSchemaItem(item.component)]
            }
        case 'Replace':
            return {
                data: { tag: item.tag },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: [standardItemToSchemaItem(item.match)] },
                    { data: { tag: 'ReplacePayload' }, children: [standardItemToSchemaItem(item.payload)] }
                ]
            }
    }
}

export class Standardizer extends StandardizerAbstract {}

//
// TODO: Create dispatch function to turn any type of valid SchemaTag tree into a StandardComponent
//
// export const standardComponentFromSchemaItem = (item: GenericTreeNode<SchemaTag>)

// export class StandardForm {
//     _key: string;
//     tag: 'Asset' | 'Character';
//     _byId: Record<string, StandardComponent>;
//     _metaData: GenericTree<SchemaTag>;

//     constructor(args: StandardFormData | GenericTree<SchemaTag>) {
//         const keysByComponentTypeFactory = (tagTree: SchemaTagTree) => (tag: SchemaWithKey["tag"]) => {
//             const keysExtract = (imported: boolean) => (
//                 tagTree
//                     .filter({ and: [{ match: tag }, imported ? { match: 'Import' } : { not: { match: 'Import' } }] })
//                     .prune({ after: { match: tag } })
//                     .prune({ before: { match: tag } })
//                     .tree
//                     .map(({ data }) => {
//                         if (data.tag !== tag) {
//                             throw new Error('standardizeSchema tag mismatch')
//                         }
//                         if (imported && isImportable(data)) {
//                             return data.as ?? data.key
//                         }
//                         return data.key
//                     })
//             )
//             return unique(keysExtract(true), keysExtract(false)).sort()
//         }
//         const standardizeComponentTagType = (componentKeys: SchemaWithKey["tag"][], tagTree: SchemaTagTree): void => {
//             //
//             // Loop through each tag in standard order
//             //
//             const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
//             componentKeys.forEach((tag) => {
//                 //
//                 // Loop through each key present for that tag
//                 //
//                 const keys = keysByComponentTypeFactory(tagTree)(tag)
//                 keys.forEach((key) => {
//                     //
//                     // Aggregate and reorder all top-level information
//                     //
//                     const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (data.key === key)) }
//                     const nodeMatchImport: TagTreeMatchOperation<SchemaTag> = { match: ({ data }, stack) => (data.tag === tag && (((Boolean(stack.find(isSchemaImport)) && isImportable(data)) ? data.as ?? data.key : data.key) === key)) }
//                     const editTag: TagTreeMatchOperation<SchemaTag> = { or: [{ match: 'Replace' }, { match: 'Remove' }] }
//                     const adjustTagTree = (tagTree: SchemaTagTree, nodeMatch: TagTreeMatchOperation<SchemaTag>): SchemaTagTree => {
//                         const prunedTagTree = tagTree
//                             .prune({ after: { sequence: [nodeMatch, anyKeyedComponent] } })
//                             .reorderFunctional(
//                                 [{ match: tag }, { match: 'Replace'}, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }, { match: 'Name' }, { match: 'ShortName' }, { match: 'Description' }, { match: 'Summary' }, { match: 'If' }, { match: 'Statement' }, { match: 'Fallthrough' }, { match: 'Inherited' }],
//                                 (tagItem) => {
//                                     const isEditTag = (value: TagListItem<SchemaTag, {}>): boolean => (['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove'].includes(value.data.tag))
//                                     const isConditionalTag = (value: TagListItem<SchemaTag, {}>): boolean => (['If', 'Statement', 'Fallthrough'].includes(value.data.tag))
//                                     const { componentTags, valueTags, conditionalTags } = tagItem.reduce<{ componentTags: TagListItem<SchemaTag>[]; valueTags: TagListItem<SchemaTag>[]; conditionalTags: TagListItem<SchemaTag>[]; matchedAlready: boolean }>((previous, subItem) => {
//                                         if (subItem.data.tag === tag) {
//                                             return {
//                                                 ...previous,
//                                                 componentTags: [...previous.componentTags, subItem],
//                                                 matchedAlready: true
//                                             }
//                                         }
//                                         if (isEditTag(subItem)) {
//                                             if (previous.matchedAlready) {
//                                                 return {
//                                                     ...previous,
//                                                     valueTags: [...previous.valueTags, subItem]
//                                                 }
//                                             }
//                                             else {
//                                                 return {
//                                                     ...previous,
//                                                     componentTags: [...previous.componentTags, subItem]
//                                                 }
//                                             }
//                                         }
//                                         if (isConditionalTag(subItem)) {
//                                             return {
//                                                 ...previous,
//                                                 conditionalTags: [...previous.conditionalTags, subItem]
//                                             }
//                                         }
//                                         else {
//                                             return {
//                                                 ...previous,
//                                                 valueTags: [...previous.valueTags, subItem]
//                                             }
//                                         }
//                                     }, { componentTags: [], valueTags: [], conditionalTags: [], matchedAlready: false })
//                                     const relativeOrder: Partial<Record<SchemaTag["tag"], number>> = {
//                                         Remove: 1,
//                                         Replace: 1,
//                                         ReplaceMatch: 2,
//                                         ReplacePayload: 2,
//                                         [tag]: 3,
//                                         Name: 4,
//                                         ShortName: 4,
//                                         Description: 4,
//                                         Summary: 4
//                                     }
//                                     const sortInPlace = (tags: TagListItem<SchemaTag>[]): TagListItem<SchemaTag>[] => (
//                                         [...tags].sort((a, b) => ((relativeOrder[a.data.tag] ?? Infinity) - (relativeOrder[b.data.tag] ?? Infinity)))
//                                     )
//                                     return [...sortInPlace(componentTags), ...sortInPlace(valueTags), ...conditionalTags]
//                                 }
//                             )
//                             .prune({ and: [{ before: nodeMatch }, { not: { or: [editTag, { after: editTag }] }}] })
//                             .prune({ or: [{ match: 'Import' }, { match: 'Export' }] })
//                         switch(tag) {
//                             case 'Room':
//                                 return prunedTagTree.prune({ or: [{ match: 'Map' }, { match: 'Position' }]})
//                             case 'Map':
//                                 return tagTree
//                                     .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
//                                     .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { or: [{ match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] } ]}, { match: 'Inherited' }])
//                                     .filter({ or: [{ and: [{ match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }]}]}, { not: { match: 'Room' }}]})
//                                     .prune({ before: nodeMatch })
//                         }
//                         return prunedTagTree
//                     }
//                     const filteredTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatch, { not: { match: 'Import' } }] }), nodeMatch)
//                     const importedTagTree = adjustTagTree(tagTree.filter({ and: [nodeMatchImport, { match: 'Import' }] }), nodeMatchImport)

//                     applyEdits(filteredTagTree.tree).forEach((item) => {
//                         const standardItem = schemaItemToStandardItem(item, tagTree.tree, false)
//                         if (standardItem) {
//                             if (this._byId[key]) {
//                                 const merged = mergeStandardComponents(this._byId[key], standardItem)
//                                 if (merged) {
//                                     this._byId[key] = merged
//                                 }
//                                 else {
//                                     delete this._byId[key]
//                                 }
//                             }
//                             else {
//                                 this._byId[key] = standardItem
//                             }
//                         }
//                     })
//                     applyEdits(markInherited(importedTagTree.tree)).forEach((item) => {
//                         const standardItem = schemaItemToStandardItem(item, tagTree.tree, true)
//                         if (standardItem && isStandardNonEdit(standardItem)) {
//                             if (this._byId[key]) {
//                                 const merged = mergeStandardComponents(this._byId[key], standardItem)
//                                 if (merged) {
//                                     this._byId[key] = merged
//                                 }
//                                 else {
//                                     delete this._byId[key]
//                                 }
//                             }
//                             else {
//                                 this._byId[key] = standardItem
//                             }
//                         }
//                     })
//                 })
//             })
//         }
//         this._byId = {}
//         this._metaData = []
//         if (!schemata.length) {
//             this._assetKey = 'Test'
//             this._assetTag = 'Asset'
//             return
//         }
//         const allAssetKeys = unique(...schemata.map((tree) => (selectKeysByTag('Asset')(tree))))
//         const allCharacterKeys = unique(...schemata.map((tree) => (selectKeysByTag('Character')(tree))))
//         const allStandardCharacters = allCharacterKeys.map((characterKey) => {
//             this._assetTag = 'Character'
//             const tagTree = new SchemaTagTree(schemata.map((tree) => {
//                 const characterNode = tree.find(({ data }) => (isSchemaCharacter(data) && data.key === characterKey))
//                 return characterNode ? [characterNode] : []
//             }).flat(1))
//             tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })
//             const characterTree = tagTree.tree
//             if (characterTree.length !== 1) {
//                 throw new Error('Too many characters in Standarizer')
//             }
//             const character = characterTree[0]
//             const pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag> = (character.children.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } })
//             const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag> |  undefined): GenericTreeNodeFiltered<InputNode, SchemaOutputTag> | undefined => (node ? { data: node.data, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })} : undefined)
//             const name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined = confirmOutputChildren(character.children.find(treeNodeTypeguard(isSchemaName)))
//             const firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaFirstImpression))
//             const oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaOneCoolThing))
//             const outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaOutfit))
//             const image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag> | undefined = character.children.find(treeNodeTypeguard(isSchemaImage))
//             this._byId[characterKey] = {
//                 tag: 'Character',
//                 key: characterKey,
//                 pronouns,
//                 name,
//                 firstImpression,
//                 oneCoolThing,
//                 outfit,
//                 image
//             }
//             this.metaData = [
//                 ...treeTypeGuard({ tree: character.children, typeGuard: isSchemaMeta }),
//                 ...character.children.filter(wrappedNodeTypeGuard(isSchemaImport))
//             ]
//             standardizeComponentTagType(['Image'], tagTree)
//             return character
//         })
//         const allStandardAssets = allAssetKeys.map((assetKey) => {
//             const tagTree = new SchemaTagTree(schemata.map((tree) => {
//                 const assetNode = tree.find(({ data }) => (isSchemaAsset(data) && data.key === assetKey))
//                 return assetNode ? [assetNode] : []
//             }).flat(1))
//             tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })

//             //
//             // Add standardized view of all Imports to the results
//             //
//             const importTagTree = tagTree
//                 .filter({ match: 'Import' })
//                 .prune({ or: [
//                     { and: [
//                         { before: { match: 'Import' } },
//                         { not: { or: [{ match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }, { match: 'Remove' }]}}
//                     ] },
//                     { after: { or: [
//                         { match: 'Room' },
//                         { match: 'Feature' },
//                         { match: 'Knowledge' },
//                         { match: 'Bookmark' },
//                         { match: 'Map' },
//                         { match: 'Message' },
//                         { match: 'Moment' },
//                         { match: 'Variable' },
//                         { match: 'Computed' },
//                         { match: 'Action' }
//                     ]}}
//                 ]})
//             const importItems = importTagTree.tree.filter(({ children }) => (children.length))
        
//             this.metaData = [
//                 ...this.metaData,
//                 ...tagTree.filter({ match: 'Meta' }).prune({ not: { match: 'Meta' }}).tree,
//                 ...importItems.filter(wrappedNodeTypeGuard(isSchemaImport)) as GenericTree<SchemaTag>
//             ]

//             const componentKeys: SchemaWithKey["tag"][] = ['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
//             const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
    
//             standardizeComponentTagType(['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action'], tagTree)

//             //
//             // Add standardized view of all Exports to the results
//             //
//             const exportTagTree = tagTree
//                 .filter({ match: 'Export' })
//                 .prune({ or: [
//                     { before: { match: 'Export' } },
//                     { after: anyKeyedComponent }
//                 ]})
//             const exports = exportTagTree.tree
//                 .filter((node): node is GenericTreeNodeFiltered<SchemaExportTag, SchemaTag> => (isSchemaExport(node.data)))
//                 .filter(({ children }) => (children.length))
//             this.metaData = [...this.metaData, ...exports]

//             return {
//                 data: { tag: 'Asset' as const, key: assetKey, Story: undefined },
//                 children: []
//             }
//         })
//         if (allStandardAssets.length + allStandardCharacters.length !== 1) {
//             throw new Error('Too many assets in Standarizer')
//         }
//         if (allStandardCharacters.length) {
//             const { data: characterData } = allStandardCharacters[0]
//             if (!(isSchemaTag(characterData) && isSchemaCharacter(characterData))) {
//                 throw new Error('Type mismatch in Standardizer')
//             }
//             this._assetKey = characterData.key
//             this._assetTag = characterData.tag
//             this._update = characterData.update ?? false
//         }
//         else {
//             const { data: assetData } = allStandardAssets[0]
//             if (!(isSchemaTag(assetData) && isSchemaAsset(assetData))) {
//                 throw new Error('Type mismatch in Standardizer')
//             }
//             this._assetKey = assetData.key
//             this._assetTag = assetData.tag
//             this._update = assetData.update ?? false
//         }
//     }
// }
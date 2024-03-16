import { unique } from "../list"
import { selectKeysByTag } from "../normalize/selectors/keysByTag"
import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAction, isSchemaAsset, isSchemaBookmark, isSchemaComputed, isSchemaDescription, isSchemaFeature, isSchemaImport, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, isSchemaVariable, isSchemaWithKey } from "../schema/baseClasses"
import { unmarkInherited } from "../schema/treeManipulation/inherited"
import { schemaOutputToString } from "../schema/utils/schemaOutput/schemaOutputToString"
import { TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "../tree/baseClasses"
import { treeTypeGuard } from "../tree/filter"
import { maybeGenericIDFromTree } from "../tree/genericIDTree"
import { SchemaStandardField, StandardComponent, StandardField } from "./baseClasses"

const reorderChildren = (order: SchemaTag["tag"][]) => (children: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return children.sort(({ data: dataA }, { data: dataB }): number => {
        const orderLookupA = order.findIndex((tag) => (tag === dataA.tag))
        const orderLookupB = order.findIndex((tag) => (tag === dataB.tag))
        if (orderLookupA === -1) {
            return orderLookupB === -1 ? 0 : 1
        }
        return orderLookupB === -1 ? -1 : orderLookupA - orderLookupB
    })
}

const stripProperties = (tag: SchemaTag): SchemaTag => {
    let returnValue = tag
    const propertiesToStrip = ['x', 'y', 'from', 'as']
    propertiesToStrip.forEach((property) => {
        if (property in returnValue) {
            returnValue = { ...returnValue, [property]: undefined }
        }
    })
    return returnValue
}

const outputNodeToStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNodeFiltered<T, SchemaTag, TreeId> | undefined,
    typeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): GenericTreeNodeFiltered<T, ChildType, TreeId> => {
    return node
        ? { ...node, children: treeTypeGuard({ tree: node.children, typeGuard }) }
        : { data: defaultValue, id: '', children: [] }
}

const schemaItemToStandardItem = ({ data, children, id }: GenericTreeNode<SchemaTag, TreeId>): StandardComponent | undefined => {
    if (isSchemaRoom(data)) {
        const shortNameItem = children.find(treeNodeTypeguard(isSchemaShortName))
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const summaryItem = children.find(treeNodeTypeguard(isSchemaSummary))
        const descriptionItem = children.find(treeNodeTypeguard(isSchemaDescription))
        const exitTagTree = new SchemaTagTree(children).filter({ match: 'Exit' })
        return {
            tag: 'Room',
            key: data.key,
            id,
            shortName: outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaOutputTag, { tag: 'ShortName' }),
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            summary: outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaOutputTag, { tag: 'Summary' }),
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaOutputTag, { tag: 'Description' }),
            exits: maybeGenericIDFromTree(exitTagTree.tree)
        }
    }
    if (isSchemaFeature(data) || isSchemaKnowledge(data)) {
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const descriptionItem = children.find(treeNodeTypeguard(isSchemaDescription))
        return {
            tag: data.tag,
            key: data.key,
            id,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaOutputTag, { tag: 'Description' }),
        }
    }
    if (isSchemaBookmark(data)) {
        return {
            tag: data.tag,
            key: data.key,
            id,
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children, id }, isSchemaOutputTag, { tag: 'Description' })
        }
    }
    if (isSchemaMessage(data)) {
        const roomsTagTree = new SchemaTagTree(children).filter({ match: 'Room' })
        return {
            tag: data.tag,
            key: data.key,
            id,
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children, id }, isSchemaOutputTag, { tag: 'Description' }),
            rooms: maybeGenericIDFromTree(roomsTagTree.tree)
        }
    }
    if (isSchemaMoment(data)) {
        const messagesTagTree = new SchemaTagTree(children).filter({ match: 'Message' })
        return {
            tag: data.tag,
            key: data.key,
            id,
            messages: maybeGenericIDFromTree(messagesTagTree.tree)
        }
    }
    if (isSchemaMap(data)) {
        const positionsTagTree = new SchemaTagTree(children).filter({ match: 'Position' })
        const imagesTagTree = new SchemaTagTree(children).filter({ match: 'Image' })
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        return {
            tag: 'Map',
            key: data.key,
            id,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            images: maybeGenericIDFromTree(imagesTagTree.tree),
            positions: maybeGenericIDFromTree(positionsTagTree.tree)
        }
    }
    if (isSchemaVariable(data)) {
        return {
            tag: 'Variable',
            key: data.key,
            id,
            default: data.default ?? ''
        }
    }
    if (isSchemaComputed(data) || isSchemaAction(data)) {
        return {
            tag: data.tag,
            key: data.key,
            id,
            src: data.src ?? ''
        }
    }
    return undefined
}

const standardFieldToOutputNode = (field: GenericTreeNode<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => (
    field.id ? [field] : []
)

const standardItemToSchemaItem = (item: StandardComponent): GenericTreeNode<SchemaTag, TreeId> => {
    switch(item.tag) {
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                id: item.id,
                children: [
                    ...[item.shortName, item.name, item.summary, item.description].map(standardFieldToOutputNode).flat(1),
                    ...item.exits
                ]
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                id: item.id,
                children: [item.name, item.description].map(standardFieldToOutputNode).flat(1)
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                id: item.id,
                children: standardFieldToOutputNode(item.description).map(({ children }) => (children)).flat(1)
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                id: item.id,
                children: [
                    ...item.rooms,
                    ...standardFieldToOutputNode(item.description).map(({ children }) => (children)).flat(1)
                ]
            }
        case 'Moment':
            return {
                data: { tag: 'Moment', key: item.key },
                id: item.id,
                children: item.messages
            }
        case 'Map':
            return {
                data: { tag: 'Map', key: item.key },
                id: item.id,
                children: [
                    ...standardFieldToOutputNode(item.name),
                    ...item.images,
                    ...item.positions
                ]
            }
        case 'Variable':
            return {
                data: { tag: 'Variable', key: item.key, default: item.default },
                id: item.id,
                children: []
            }
        case 'Computed':
        case 'Action':
            return {
                data: { tag: item.tag, key: item.key, src: item.src },
                id: item.id,
                children: []
            }
    }
}

export class Standardizer {
    _assetKey: string;
    _assetId: string;
    _byId: Record<string, StandardComponent>;
    _imports: Record<string, StandardField<GenericTree<SchemaTag, TreeId>>>;
    _exports: GenericTree<SchemaTag, TreeId>;
    constructor(...schemata: GenericTree<SchemaTag, Partial<TreeId & { inherited: boolean }>>[]) {
        this._byId = {}
        this._imports = {}
        this._exports = []
        const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
        const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
        const allAssetKeys = unique(...schemata.map((tree) => (selectKeysByTag('Asset')(tree))))
        const allStandardAssets = allAssetKeys.map((assetKey) => {
            const tagTree = new SchemaTagTree(schemata.map((tree) => {
                const assetNode = tree.find(({ data }) => (isSchemaAsset(data) && data.key === assetKey))
                return assetNode ? [assetNode] : []
            }).flat(1))
            tagTree._merge = ({ data: dataA, id: idA, inherited: inheritedA }, { data: dataB, id: idB, inherited: inheritedB }) => (
                inheritedA && !inheritedB
                    ? { data: { ...dataA, ...dataB }, id: idB ?? idA }
                    : { data: { ...dataA, ...dataB }, id: idA ?? idB }
            )

                        //
            // Add standardized view of all Imports to the results
            //
            const importTagTree = tagTree
                .filter({ match: 'Import' })
                .prune({ or: [
                    { before: { match: 'Import' } },
                    { after: { or: [
                        { match: 'Room' },
                        { match: 'Feature' },
                        { match: 'Knowledge' },
                        { match: 'Bookmark' },
                        { match: 'Map' },
                        { match: 'Message' },
                        { match: 'Moment' },
                        { match: 'Variable' },
                        { match: 'Computed' },
                        { match: 'Action' }
                    ]}}
                ]})
            const importItems = importTagTree.tree.filter(({ children }) => (children.length))
            const importedKeys = unique(tagTree
                .filter({ match: 'Import' })
                .prune({ or: [{ before: { match: 'Import' } }, { match: 'Import' }] })
                .tree
                .map(({ data }) => (data))
                .filter(isSchemaWithKey)
                .map(({ key }) => (key)))
        
            this._imports = Object.assign({}, ...importItems.map(({ data, children, id }) => {
                if (!isSchemaImport(data)) {
                    throw new Error('Import mismatch on Standardizer')
                }
                return { [data.from]: { id, value: children } }
            }))
        
            const keysByComponentType = (tag: SchemaWithKey["tag"]) => (
                unique(tagTree
                    .filter({ match: tag })
                    .prune({ after: { match: tag } })
                    .prune({ before: { match: tag } })
                    .tree
                    .map(({ data }) => {
                        if (data.tag !== tag) {
                            throw new Error('standardizeSchema tag mismatch')
                        }
                        return data.key
                    })
                ).sort()
            )
    
            //
            // Loop through each tag in standard order
            //
            componentKeys.forEach((tag) => {
                //
                // Loop through each key present for that tag
                //
                const keys = keysByComponentType(tag)
                keys.forEach((key) => {
                    //
                    // Aggregate and reorder all top-level information
                    //
                    const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }) => (data.tag === tag && data.key === key) }
                    let filteredTagTree = tagTree
                        .filter(nodeMatch)
                        .prune({ or: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { match: 'Import' }, { match: 'Export' }] })
                        .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'ShortName' }, { match: 'Description' }, { match: 'Summary' }] }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                        .prune({ before: nodeMatch })
                    switch(tag) {
                        case 'Room':
                            filteredTagTree = filteredTagTree.filter({ not: { match: 'Position' }})
                            break
                        case 'Map':
                            filteredTagTree = tagTree
                                .filter(nodeMatch)
                                .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
                                .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                                .prune({ before: nodeMatch })
                            break
                    }
                    const items = unmarkInherited(maybeGenericIDFromTree(filteredTagTree.tree))
                    //
                    // TODO: Replace topLevelItems.push with a write of a StandardItem into this._byId
                    //
                    items.forEach((item) => {
                        const standardItem = schemaItemToStandardItem(item)
                        if (standardItem && (item.children.length || !importedKeys.includes(key))) {
                            this._byId[key] = standardItem
                        }
                    })
                })
            })

            //
            // Add standardized view of all Exports to the results
            //
            const exportTagTree = tagTree
                .filter({ match: 'Export' })
                .prune({ or: [
                    { before: { match: 'Export' } },
                    { after: anyKeyedComponent }
                ]})
            this._exports = maybeGenericIDFromTree(exportTagTree.tree.filter(({ children }) => (children.length)))

            const id = schemata.reduce<string | undefined>((previous, tree) => {
                const item = tree.find(({ data }) => (isSchemaWithKey(data) && data.key === assetKey))
                if (item && !item.inherited) {
                    return item.id ?? previous
                }
                return previous
            }, undefined)
            return {
                data: { tag: 'Asset', key: assetKey, Story: undefined },
                children: [],
                id
            }
        })
        if (allStandardAssets.length !== 1) {
            throw new Error('Too many assets in Standarizer')
        }
        this._assetKey = allStandardAssets[0].data.key
        this._assetId = allStandardAssets[0].id ?? ''
    }

    get schema(): GenericTree<SchemaTag, TreeId> {
        const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
        const children = [
            ...Object.entries(this._imports).map(([from, { id, value: children }]): GenericTreeNode<SchemaTag, TreeId> => ({ data: { tag: 'Import' as const, from, mapping: {} }, id, children })),
            ...componentKeys
                .map((tagToList) => (
                    Object.values(this._byId)
                        .filter(({ tag }) => (tag === tagToList))
                        .map(standardItemToSchemaItem)
                ))
                .flat(1),
            ...this._exports
        ]
        return [{
            data: { tag: 'Asset', key: this._assetKey, Story: undefined },
            children,
            id: this._assetId
        }]
    }
}
import { v4 as uuidv4 } from 'uuid'
import { objectMap } from "../lib/objects"
import { unique } from "../list"
import { selectKeysByTag } from "../normalize/selectors/keysByTag"
import { SchemaAssetTag, SchemaCharacterTag, SchemaDescriptionTag, SchemaExportTag, SchemaFirstImpressionTag, SchemaImportTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAction, isSchemaAsset, isSchemaBookmark, isSchemaCharacter, isSchemaComputed, isSchemaConditionStatement, isSchemaDescription, isSchemaExport, isSchemaFeature, isSchemaFirstImpression, isSchemaImport, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaOutputTag, isSchemaPronouns, isSchemaRoom, isSchemaShortName, isSchemaSummary, isSchemaTag, isSchemaVariable, isSchemaWithKey } from "../schema/baseClasses"
import { unmarkInherited } from "../schema/treeManipulation/inherited"
import { TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "../tree/baseClasses"
import { treeTypeGuard } from "../tree/filter"
import { maybeGenericIDFromTree, stripIDFromTree } from "../tree/genericIDTree"
import { map } from "../tree/map"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, StandardForm, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom } from "./baseClasses"

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
        case 'Character':
            const { tag, ...pronouns } = item.pronouns.data
            return {
                data: { tag: 'Character', key: item.key, Pronouns: pronouns },
                id: item.id,
                children: [
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit].map(standardFieldToOutputNode).flat(1),
                ]
            }
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
            return {
                data: { tag: item.tag, key: item.key, src: item.src, dependencies: item.dependencies },
                id: item.id,
                children: []
            }
        case 'Action':
            return {
                data: { tag: item.tag, key: item.key, src: item.src },
                id: item.id,
                children: []
            }
    }
}

export const serializedStandardItemToSchemaItem = (item: SerializableStandardComponent): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const { tag, ...pronouns } = item.pronouns.data
            return {
                data: { tag: 'Character', key: item.key, Pronouns: pronouns },
                children: [
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit],
                ]
            }
        case 'Room':
            return {
                data: { tag: 'Room', key: item.key },
                children: [
                    ...[item.shortName, item.name, item.summary, item.description],
                    ...item.exits
                ]
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: [item.name, item.description]
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: item.description.children
            }
        case 'Message':
            return {
                data: { tag: 'Message', key: item.key },
                children: [
                    ...item.rooms,
                    ...item.description.children
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
                children: [
                    item.name,
                    ...item.images,
                    ...item.positions
                ]
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
    }
}

export class Standardizer {
    _assetKey: string;
    _assetTag: (SchemaAssetTag | SchemaCharacterTag)["tag"];
    _assetId: string;
    _byId: StandardForm["byId"];
    metaData: StandardForm["metaData"];
    constructor(...schemata: GenericTree<SchemaTag, Partial<TreeId & { inherited: boolean }>>[]) {
        this._byId = {}
        this.metaData = []
        if (!schemata.length) {
            this._assetId = 'Test'
            this._assetKey = 'Test'
            this._assetTag = 'Asset'
            return
        }
        const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
        const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
        const allAssetKeys = unique(...schemata.map((tree) => (selectKeysByTag('Asset')(tree))))
        const allCharacterKeys = unique(...schemata.map((tree) => (selectKeysByTag('Character')(tree))))
        const allStandardCharacters = allCharacterKeys.map((characterKey) => {
            this._assetTag = 'Character'
            const tagTree = new SchemaTagTree(schemata.map((tree) => {
                const characterNode = tree.find(({ data }) => (isSchemaCharacter(data) && data.key === characterKey))
                return characterNode ? [characterNode] : []
            }).flat(1))
            tagTree._merge = ({ data: dataA, id: idA, inherited: inheritedA }, { data: dataB, id: idB, inherited: inheritedB }) => (
                inheritedA && !inheritedB
                    ? { data: { ...dataA, ...dataB }, id: idB ?? idA }
                    : { data: { ...dataA, ...dataB }, id: idA ?? idB }
            )
            const characterTree = tagTree.tree
            if (characterTree.length !== 1) {
                throw new Error('Too many characters in Standarizer')
            }
            const character = maybeGenericIDFromTree(characterTree)[0]
            const pronouns: GenericTreeNodeFiltered<SchemaPronounsTag, SchemaTag, TreeId> = (character.children.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' }, id: '' })
            const confirmOutputChildren = <InputNode extends SchemaTag>(node: GenericTreeNodeFiltered<InputNode, SchemaTag, TreeId>): GenericTreeNodeFiltered<InputNode, SchemaOutputTag, TreeId> => ({ data: node.data, id: node.id, children: treeTypeGuard({ tree: node.children, typeGuard: isSchemaOutputTag })})
            const name: GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag, TreeId> = confirmOutputChildren(character.children.find(treeNodeTypeguard(isSchemaName)) ?? { children: [], data: { tag: 'Name' }, id: '' })
            const firstImpression: GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag, TreeId> = character.children.find(treeNodeTypeguard(isSchemaFirstImpression)) ?? { children: [], data: { tag: 'FirstImpression', value: '' }, id: '' }
            const oneCoolThing: GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag, TreeId> = character.children.find(treeNodeTypeguard(isSchemaOneCoolThing)) ?? { children: [], data: { tag: 'OneCoolThing', value: '' }, id: '' }
            const outfit: GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag, TreeId> = character.children.find(treeNodeTypeguard(isSchemaOutfit)) ?? { children: [], data: { tag: 'Outfit', value: '' }, id: '' }
            this._byId[characterKey] = {
                tag: 'Character',
                key: characterKey,
                id: character.id,
                pronouns,
                name,
                firstImpression,
                oneCoolThing,
                outfit
            }
            this.metaData = treeTypeGuard({ tree: character.children, typeGuard: isSchemaImport })
            return character
        })
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
        
            this.metaData = [...this.metaData, ...importItems.filter((node): node is GenericTreeNodeFiltered<SchemaImportTag, SchemaTag, TreeId> => (isSchemaImport(node.data)))]
        
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
            const exports = maybeGenericIDFromTree(exportTagTree.tree)
                .filter((node): node is GenericTreeNodeFiltered<SchemaExportTag, SchemaTag, TreeId> => (isSchemaExport(node.data)))
                .filter(({ children }) => (children.length))
            this.metaData = [...this.metaData, ...exports]

            const id = schemata.reduce<string | undefined>((previous, tree) => {
                const item = tree.find(({ data }) => (isSchemaWithKey(data) && data.key === assetKey))
                if (item && !item.inherited) {
                    return item.id ?? previous
                }
                return previous
            }, undefined)
            return {
                data: { tag: 'Asset' as const, key: assetKey, Story: undefined },
                children: [],
                id
            }
        })
        if (allStandardAssets.length + allStandardCharacters.length !== 1) {
            throw new Error('Too many assets in Standarizer')
        }
        if (allStandardCharacters.length) {
            const { data: characterData } = allStandardCharacters[0]
            if (!(isSchemaTag(characterData) && isSchemaCharacter(characterData))) {
                throw new Error('Type mismatch in Standardizer')
            }
            this._assetKey = characterData.key
            this._assetTag = characterData.tag
            this._assetId = allStandardCharacters[0].id ?? ''
        }
        else {
            const { data: assetData } = allStandardAssets[0]
            if (!(isSchemaTag(assetData) && isSchemaAsset(assetData))) {
                throw new Error('Type mismatch in Standardizer')
            }
            this._assetKey = assetData.key
            this._assetTag = assetData.tag
            this._assetId = allStandardAssets[0].id ?? ''
        }
    }

    get schema(): GenericTree<SchemaTag, TreeId> {
        if (this._assetTag === 'Asset') {
            const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
            const children = [
                ...this.metaData.filter(treeNodeTypeguard(isSchemaImport)),
                ...componentKeys
                    .map((tagToList) => (
                        Object.values(this._byId)
                            .filter(({ tag }) => (tag === tagToList))
                            .map(standardItemToSchemaItem)
                    ))
                    .flat(1),
                ...this.metaData.filter(treeNodeTypeguard(isSchemaExport))
            ]
            return [{
                data: { tag: this._assetTag, key: this._assetKey, Story: undefined },
                children,
                id: this._assetId
            }]
        }
        if (this._assetTag === 'Character') {
            return [standardItemToSchemaItem(this._byId[this._assetKey])]
            const { tag, ...pronouns }: SchemaPronounsTag = (this.metaData.find(treeNodeTypeguard(isSchemaPronouns)) ?? { children: [], data: { tag: 'Pronouns', subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } }).data
            return [{
                data: { tag: 'Character', key: this._assetKey, Pronouns: pronouns },
                children: this.metaData,
                id: this._assetId
            }]
        }
        throw new Error('Invalid internal tags on Standardizer schema')
    }

    loadStandardForm(standard: StandardForm): void {
        this._assetKey = standard.key
        this._assetTag = standard.tag
        this._byId = standard.byId
        this.metaData = standard.metaData
    }

    get standardForm(): StandardForm {
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId: this._byId,
            metaData: this.metaData
        }
    }

    assignDependencies(extract: (src: string) => string[]) {
        const assignedSchema = 
            map(this.schema, (node: GenericTreeNode<SchemaTag, TreeId>): GenericTree<SchemaTag,TreeId> => {
                if (isSchemaConditionStatement(node.data)) {
                    return [{
                        ...node,
                        data: {
                            ...node.data,
                            dependencies: extract(node.data.if)
                        }
                    }]
                }
                if (isSchemaComputed(node.data)) {
                    return [{
                        ...node,
                        data: {
                            ...node.data,
                            dependencies: extract(node.data.src),
                        }
                    }]
                }
                return [node]
            })
        const assignedStandardizer = new Standardizer(assignedSchema)
        this.loadStandardForm(assignedStandardizer.standardForm)
    }

    get stripped(): SerializableStandardForm {
        const byId: SerializableStandardForm["byId"] = objectMap(this._byId, (value) => {
            const { id, ...rest } = value
            const stripValue = <T extends StandardComponent, K extends keyof T, FilterType extends SchemaTag, InnerType extends SchemaTag>(item: T, key: K): T[K] extends GenericTreeNodeFiltered<FilterType, InnerType, TreeId> ? GenericTreeNodeFiltered<FilterType, InnerType> : never => {
                const { id, ...subItem } = item[key] as GenericTreeNodeFiltered<FilterType, InnerType, TreeId>
                return { ...subItem, children: stripIDFromTree(subItem.children) } as T[K] extends GenericTreeNodeFiltered<FilterType, InnerType, TreeId> ? GenericTreeNodeFiltered<FilterType, InnerType> : never
            }
            if (isStandardBookmark(value)) {
                return {
                    ...rest,
                    description: stripValue(value, 'description')
                }
            }
            if (isStandardFeature(value) || isStandardKnowledge(value)) {
                return {
                    ...rest,
                    name: stripValue(value, 'name'),
                    description: stripValue(value, 'description')
                }
            }
            if (isStandardMap(value)) {
                return {
                    ...rest,
                    name: stripValue(value, 'name'),
                    positions: stripIDFromTree(value.positions),
                    images: stripIDFromTree(value.images)
                }
            }
            if (isStandardRoom(value)) {
                return {
                    ...rest,
                    shortName: stripValue(value, 'shortName'),
                    name: stripValue(value, 'name'),
                    summary: stripValue(value, 'summary'),
                    description: stripValue(value, 'description'),
                    exits: stripIDFromTree(value.exits)
                }
            }
            if (isStandardMessage(value)) {
                return {
                    ...rest,
                    description: stripValue(value, 'description'),
                    rooms: stripIDFromTree(value.rooms)
                }
            }
            if (isStandardMoment(value)) {
                return {
                    ...rest,
                    messages: stripIDFromTree(value.messages)
                }
            }
            return rest
        })
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId,
            metaData: stripIDFromTree(this.metaData)
        }
    }

    deserialize(standard: SerializableStandardForm): void {
        const byId: StandardForm["byId"] = objectMap(standard.byId, (value) => {
            const deserializeValue = <T extends SerializableStandardComponent, K extends keyof T, FilterType extends SchemaTag, InnerType extends SchemaTag>(item: T, key: K): T[K] extends GenericTreeNodeFiltered<FilterType, InnerType> ? GenericTreeNodeFiltered<FilterType, InnerType, TreeId> : never => {
                const subItem = item[key] as GenericTreeNodeFiltered<FilterType, InnerType>
                return { ...subItem, id: subItem.children.length ? uuidv4() : '', children: maybeGenericIDFromTree(subItem.children) } as T[K] extends GenericTreeNodeFiltered<FilterType, InnerType> ? GenericTreeNodeFiltered<FilterType, InnerType, TreeId> : never
            }
            if (value.tag === 'Bookmark') {
                return {
                    ...value,
                    id: uuidv4(),
                    description: deserializeValue(value, 'description')
                }
            }
            if (value.tag === 'Feature' || value.tag === 'Knowledge') {
                return {
                    ...value,
                    id: uuidv4(),
                    name: deserializeValue(value, 'name'),
                    description: deserializeValue(value, 'description')
                }
            }
            if (value.tag === 'Map') {
                return {
                    ...value,
                    id: uuidv4(),
                    name: deserializeValue(value, 'name'),
                    positions: maybeGenericIDFromTree(value.positions),
                    images: maybeGenericIDFromTree(value.images)
                }
            }
            if (value.tag === 'Room') {
                return {
                    ...value,
                    id: uuidv4(),
                    shortName: deserializeValue(value, 'shortName'),
                    name: deserializeValue(value, 'name'),
                    summary: deserializeValue(value, 'summary'),
                    description: deserializeValue(value, 'description'),
                    exits: maybeGenericIDFromTree(value.exits)
                }
            }
            if (value.tag === 'Message') {
                return {
                    ...value,
                    id: uuidv4(),
                    description: deserializeValue(value, 'description'),
                    rooms: maybeGenericIDFromTree(value.rooms)
                }
            }
            if (value.tag === 'Moment') {
                return {
                    ...value,
                    id: uuidv4(),
                    messages: maybeGenericIDFromTree(value.messages)
                }
            }
            if (value.tag === 'Character') {
                return {
                    ...value,
                    id: uuidv4(),
                    name: deserializeValue(value, 'name'),
                    firstImpression: deserializeValue(value, 'firstImpression'),
                    oneCoolThing: deserializeValue(value, 'oneCoolThing'),
                    outfit: deserializeValue(value, 'outfit'),
                    pronouns: { ...value.pronouns, id: uuidv4(), children: maybeGenericIDFromTree(value.pronouns.children) }
                }
            }
            return { ...value, id: uuidv4() }
        })
        this._assetKey = standard.key
        this._assetTag = standard.tag
        this._byId = byId
        this.metaData = maybeGenericIDFromTree(standard.metaData)
    }
}
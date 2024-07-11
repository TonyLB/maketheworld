import { v4 as uuidv4 } from 'uuid'
import { objectMap } from "../lib/objects"
import { unique } from "../list"
import { selectKeysByTag } from "../normalize/selectors/keysByTag"
import { SchemaAssetTag, SchemaCharacterTag, SchemaDescriptionTag, SchemaExportTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaImportTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAction, isSchemaTheme, isSchemaAsset, isSchemaBookmark, isSchemaCharacter, isSchemaComputed, isSchemaConditionStatement, isSchemaDescription, isSchemaExport, isSchemaFeature, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaOutputTag, isSchemaPronouns, isSchemaRoom, isSchemaShortName, isSchemaSummary, isSchemaTag, isSchemaVariable, isSchemaWithKey, isSchemaPrompt, isSchemaCondition, isSchemaConditionFallthrough, isSchemaExit } from "../schema/baseClasses"
import { unmarkInherited } from "../schema/treeManipulation/inherited"
import { TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "../tree/baseClasses"
import { treeTypeGuard } from "../tree/filter"
import { maybeGenericIDFromTree, stripIDFromTree } from "../tree/genericIDTree"
import { map } from "../tree/map"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, StandardForm, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom } from "./baseClasses"

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

const outputNodeToStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    node: GenericTreeNodeFiltered<T, SchemaTag, TreeId> | undefined,
    typeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
): GenericTreeNodeFiltered<T, ChildType, TreeId> => {
    return node
        ? { ...node, children: treeTypeGuard({ tree: defaultSelected(node.children), typeGuard }) }
        : { data: defaultValue, id: '', children: [] }
}

const transformStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
    callback: (tree: GenericTree<SchemaTag, TreeId>) => GenericTree<SchemaTag, TreeId>,
    typeGuard: (value: SchemaTag) => value is T,
    childTypeGuard: (value: SchemaTag) => value is ChildType,
    defaultValue: T
) => (node: GenericTreeNodeFiltered<T, SchemaTag, TreeId> | undefined): GenericTreeNodeFiltered<T, ChildType, TreeId> => {
    const transformedTree = node ? callback([node]) : []
    if (transformedTree.length === 0) {
        return { data: defaultValue, id: '', children: [] }
    }
    const transformedNode = transformedTree[0]
    if (transformedTree.length > 1 || !treeNodeTypeguard(typeGuard)(transformedNode)) {
        throw new Error('Invalid return value in transformStandardItem')
    }
    return { ...transformedNode, children: treeTypeGuard({ tree: maybeGenericIDFromTree(defaultSelected(transformedNode.children)), typeGuard: childTypeGuard }) }
}

const transformStandardComponent = (callback: (tree: GenericTree<SchemaTag, TreeId>) => GenericTree<SchemaTag, TreeId>) => (component: StandardComponent): StandardComponent | undefined => {
    switch(component.tag) {
        case 'Room':
            return {
                tag: 'Room',
                key: component.key,
                id: component.id,
                shortName: transformStandardItem(callback, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' })(component.shortName),
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                summary: transformStandardItem(callback, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' })(component.summary),
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description),
                exits: defaultSelected(maybeGenericIDFromTree(callback(component.exits))).filter(treeNodeTypeguard(isSchemaExit)),
                themes: defaultSelected(maybeGenericIDFromTree(callback(component.themes))).filter(treeNodeTypeguard(isSchemaTheme))
            }
        case 'Feature':
        case 'Knowledge':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description)
            }
        case 'Bookmark':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description)
            }
        case 'Message':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                description: transformStandardItem(callback, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })(component.description),
                rooms: defaultSelected(maybeGenericIDFromTree(callback(component.rooms))).filter(treeNodeTypeguard(isSchemaRoom))
            }
        case 'Moment':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                messages: defaultSelected(maybeGenericIDFromTree(callback(component.messages))).filter(treeNodeTypeguard(isSchemaMessage))
            }
        case 'Map':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                images: defaultSelected(maybeGenericIDFromTree(callback(component.images))).filter(treeNodeTypeguard(isSchemaImage)),
                positions: defaultSelected(maybeGenericIDFromTree(callback(component.positions))).filter(treeNodeTypeguard(isSchemaRoom)),
                themes: defaultSelected(maybeGenericIDFromTree(callback(component.themes))).filter(treeNodeTypeguard(isSchemaTheme))
            }
        case 'Theme':
            return {
                tag: component.tag,
                key: component.key,
                id: component.id,
                name: transformStandardItem(callback, isSchemaName, isSchemaOutputTag, { tag: 'Name' })(component.name),
                prompts: defaultSelected(maybeGenericIDFromTree(callback(component.prompts))).filter(treeNodeTypeguard(isSchemaPrompt)),
                rooms: defaultSelected(maybeGenericIDFromTree(callback(component.rooms))).filter(treeNodeTypeguard(isSchemaRoom)),
                maps: defaultSelected(maybeGenericIDFromTree(callback(component.maps))).filter(treeNodeTypeguard(isSchemaMap))
            }
        case 'Variable':
        case 'Computed':
        case 'Action':
            return component
        default:
            return undefined
    }
}

const mergeStandardComponents = (base: StandardComponent, incoming: StandardComponent): StandardComponent => {
    switch(base.tag) {
        case 'Room':
            if (!isStandardRoom(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Room',
                key: base.key,
                id: base.id,
                shortName: { ...base.shortName, children: [...base.shortName.children, ...incoming.shortName.children] },
                name: { ...base.name, children: [...base.name.children, ...incoming.name.children] },
                summary: { ...base.summary, children: [...base.summary.children, ...incoming.summary.children] },
                description: { ...base.description, children: [...base.description.children, ...incoming.description.children] },
                exits: [...base.exits, ...incoming.exits],
                themes: [...base.themes, ...incoming.themes]
            }
        case 'Feature':
        case 'Knowledge':
            if ((isStandardFeature(base) && !isStandardFeature(incoming)) || !isStandardKnowledge(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: base.tag,
                key: base.key,
                id: base.id,
                name: { ...base.name, children: [...base.name.children, ...incoming.name.children] },
                description: { ...base.description, children: [...base.description.children, ...incoming.description.children] }
            }
        case 'Bookmark':
            if (!isStandardBookmark(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Bookmark',
                key: base.key,
                id: base.id,
                description: { ...base.description, children: [...base.description.children, ...incoming.description.children] }
            }
        case 'Message':
            if (!isStandardMessage(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Message',
                key: base.key,
                id: base.id,
                description: { ...base.description, children: [...base.description.children, ...incoming.description.children] },
                rooms: [...base.rooms, ...incoming.rooms]
            }
        case 'Moment':
            if (!isStandardMoment(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Moment',
                key: base.key,
                id: base.id,
                messages: [...base.messages, ...incoming.messages]
            }
        case 'Map':
            if (!isStandardMap(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Map',
                key: base.key,
                id: base.id,
                name: { ...base.name, children: [...base.name.children, ...incoming.name.children] },
                positions: [...base.positions, ...incoming.positions],
                images: [...base.images, ...incoming.images],
                themes: [...base.themes, ...incoming.themes]
            }
        case 'Theme':
            if (!isStandardTheme(incoming)) { throw new Error('Type mismatch') }
            return {
                tag: 'Theme',
                key: base.key,
                id: base.id,
                name: { ...base.name, children: [...base.name.children, ...incoming.name.children] },
                prompts: [...base.prompts, ...incoming.prompts],
                rooms: [...base.rooms, ...incoming.rooms],
                maps: [...base.maps, ...incoming.maps]
            }
        case 'Variable':
        case 'Computed':
        case 'Action':
            return base
        default:
            throw new Error('Invalid incoming StandardComponent')
    }
}

const schemaItemToStandardItem = ({ data, children, id }: GenericTreeNode<SchemaTag, TreeId>, fullSchema: GenericTree<SchemaTag, TreeId>): StandardComponent | undefined => {
    if (isSchemaRoom(data)) {
        const shortNameItem = children.find(treeNodeTypeguard(isSchemaShortName))
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const summaryItem = children.find(treeNodeTypeguard(isSchemaSummary))
        const descriptionItem = children.find(treeNodeTypeguard(isSchemaDescription))
        const exitTagTree = new SchemaTagTree(children)
            .filter({ match: 'Exit' })
            .reorderedSiblings([['Room', 'Exit'], ['If']])
        const themeTagTree = new SchemaTagTree(fullSchema).filter({ and: [{ match: 'Theme' }, { match: ({ data: check }) => (isSchemaRoom(check) && check.key === data.key)}] }).prune({ not: { or: [{ match: 'Room' }, { match: 'Theme' }] } })
        return {
            tag: 'Room',
            key: data.key,
            id,
            shortName: outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaOutputTag, { tag: 'ShortName' }),
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            summary: outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaOutputTag, { tag: 'Summary' }),
            description: outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaOutputTag, { tag: 'Description' }),
            exits: defaultSelected(maybeGenericIDFromTree(exitTagTree.tree)),
            themes: maybeGenericIDFromTree(themeTagTree.tree).filter(treeNodeTypeguard(isSchemaTheme))
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
        const positionsTagTree = new SchemaTagTree(children)
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
            .prune({ not: { or: [
                { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { match: 'Position' }, { match: 'Exit' }
            ]}})
            .reorderedSiblings([['Room', 'Exit', 'Position'], ['If']])
        
        const imagesTagTree = new SchemaTagTree(children).filter({ match: 'Image' })
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const themeTagTree = new SchemaTagTree(fullSchema).filter({ and: [{ match: 'Theme' }, { match: ({ data: check }) => (isSchemaMap(check) && check.key === data.key)}] }).prune({ not: { or: [{ match: 'Map' }, { match: 'Theme' }] } })
        return {
            tag: 'Map',
            key: data.key,
            id,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            images: defaultSelected(maybeGenericIDFromTree(imagesTagTree.tree)),
            positions: defaultSelected(maybeGenericIDFromTree(positionsTagTree.tree)),
            themes: maybeGenericIDFromTree(themeTagTree.tree).filter(treeNodeTypeguard(isSchemaTheme))
        }
    }
    if (isSchemaTheme(data)) {
        const nameItem = children.find(treeNodeTypeguard(isSchemaName))
        const promptTagTree = new SchemaTagTree(children).filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
        const roomTagTree = new SchemaTagTree(children).filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
        const mapsTagTree = new SchemaTagTree(children).filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
        return {
            tag: 'Theme',
            key: data.key,
            id,
            name: outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaOutputTag, { tag: 'Name' }),
            prompts: maybeGenericIDFromTree(promptTagTree.tree).filter(treeNodeTypeguard(isSchemaPrompt)),
            rooms: maybeGenericIDFromTree(roomTagTree.tree),
            maps: maybeGenericIDFromTree(mapsTagTree.tree)
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
                    ...[item.name, item.pronouns, item.firstImpression, item.oneCoolThing, item.outfit, item.image].map(standardFieldToOutputNode).flat(1),
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
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                id: item.id,
                children: [
                    ...standardFieldToOutputNode(item.name),
                    ...item.prompts,
                    ...item.rooms,
                    ...item.maps
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
        case 'Image':
            return {
                data: { tag: item.tag, key: item.key },
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
                children: defaultSelected([
                    ...[item.shortName, item.name, item.summary, item.description],
                    ...item.exits
                ])
            }
        case 'Feature':
        case 'Knowledge':
            return {
                data: { tag: item.tag, key: item.key },
                children: defaultSelected([item.name, item.description])
            }
        case 'Bookmark':
            return {
                data: { tag: 'Bookmark', key: item.key },
                children: defaultSelected(item.description.children)
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
                children: defaultSelected([
                    item.name,
                    ...item.images,
                    ...item.positions
                ])
            }
        case 'Theme':
            return {
                data: { tag: 'Theme', key: item.key },
                children: [
                    item.name,
                    ...item.rooms,
                    ...item.maps
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
        case 'Image':
            return {
                data: { tag: item.tag, key: item.key },
                children: []
            }
    }
}

export class StandardizerAbstract {
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
        const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
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
            const image: GenericTreeNodeFiltered<SchemaImageTag, SchemaTag, TreeId> = character.children.find(treeNodeTypeguard(isSchemaImage)) ?? { children: [], data: { tag: 'Image', key: '' }, id: '' }
            this._byId[characterKey] = {
                tag: 'Character',
                key: characterKey,
                id: character.id,
                pronouns,
                name,
                firstImpression,
                oneCoolThing,
                outfit,
                image
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
                            filteredTagTree = filteredTagTree.prune({ or: [{ match: 'Map' }, { match: 'Position' }]})
                            break
                        case 'Map':
                            filteredTagTree = tagTree
                                .filter(nodeMatch)
                                .prune({ or: [{ and: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { not: { match: 'Position'} }] }, { match: 'Import' }, { match: 'Export' }] })
                                .reordered([{ match: tag }, { or: [{ match: 'Name' }, { match: 'Description' }] }, { or: [{ match: 'Room' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] } ]}, { match: 'Inherited' }])
                                .filter(({ or: [{ match: 'Image' }, { match: 'Name' }, { match: 'Theme' }, { and: [{ match: 'If' }, { not: { match: 'Room' }}] }, { and: [{ match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }]}] }]}))
                                .prune({ before: nodeMatch })
                            if (!filteredTagTree.tree.length) {
                                filteredTagTree = tagTree.prune({ not: { match: 'Map' }})
                            }
                            break
                    }
                    const items = unmarkInherited(maybeGenericIDFromTree(filteredTagTree.tree))
                    //
                    // TODO: Replace topLevelItems.push with a write of a StandardItem into this._byId
                    //
                    items.forEach((item) => {
                        const standardItem = schemaItemToStandardItem(item, maybeGenericIDFromTree(tagTree.tree))
                        if (standardItem && (item.children.length || !importedKeys.includes(key) || !(key in this._byId))) {
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
            //
            // Extract keys from imports, and check when listing components whether it is an empty
            // item which is already represented in import (and exclude if so)
            //
            const imports = this.metaData.filter(treeNodeTypeguard(isSchemaImport))
            const importKeys = unique(imports.map(({ children }) => (children.map(({ data }) => (data)).filter(isSchemaWithKey).map(({ key }) => (key)))).flat(1))
            const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
            const children = [
                ...imports,
                ...componentKeys
                    .map((tagToList) => (
                        Object.values(this._byId)
                            .filter(({ tag }) => (tag === tagToList))
                            .map(standardItemToSchemaItem)
                            .filter(({ data, children }) => (children.length || !(isSchemaWithKey(data) && importKeys.includes(data.key))))
                    ))
                    .flat(1),
                ...this.metaData.filter(treeNodeTypeguard(isSchemaExport))
            ]
            return [{
                data: { tag: this._assetTag, key: this._assetKey, Story: undefined },
                children: defaultSelected(children),
                id: this._assetId
            }]
        }
        if (this._assetTag === 'Character') {
            const character = standardItemToSchemaItem(this._byId[this._assetKey])
            return [{
                ...character,
                children: defaultSelected([
                    ...character.children,
                    ...this.metaData.filter(treeNodeTypeguard(isSchemaImport))
                ])
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
        const assignedStandardizer = new StandardizerAbstract(assignedSchema)
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
                    images: stripIDFromTree(value.images),
                    themes: stripIDFromTree(value.themes).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (isStandardTheme(value)) {
                return {
                    ...rest,
                    name: stripValue(value, 'name'),
                    prompts: stripIDFromTree(value.prompts).filter(treeNodeTypeguard(isSchemaPrompt)),
                    rooms: stripIDFromTree(value.rooms),
                    maps: stripIDFromTree(value.maps)
                }
            }
            if (isStandardRoom(value)) {
                return {
                    ...rest,
                    shortName: stripValue(value, 'shortName'),
                    name: stripValue(value, 'name'),
                    summary: stripValue(value, 'summary'),
                    description: stripValue(value, 'description'),
                    exits: stripIDFromTree(value.exits),
                    themes: stripIDFromTree(value.themes).filter(treeNodeTypeguard(isSchemaTheme))
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
                    images: maybeGenericIDFromTree(value.images),
                    themes: maybeGenericIDFromTree(value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (value.tag === 'Theme') {
                return {
                    ...value,
                    id: uuidv4(),
                    name: deserializeValue(value, 'name'),
                    prompts: maybeGenericIDFromTree(value.prompts).filter(treeNodeTypeguard(isSchemaPrompt)),
                    rooms: maybeGenericIDFromTree(value.rooms),
                    maps: maybeGenericIDFromTree(value.maps)
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
                    exits: maybeGenericIDFromTree(value.exits),
                    themes: maybeGenericIDFromTree(value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
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
                    firstImpression: { ...value.firstImpression, id: uuidv4(), children: maybeGenericIDFromTree(value.firstImpression.children) },
                    oneCoolThing: { ...value.oneCoolThing, id: uuidv4(), children: maybeGenericIDFromTree(value.oneCoolThing.children) },
                    outfit: { ...value.outfit, id: uuidv4(), children: maybeGenericIDFromTree(value.outfit.children) },
                    pronouns: { ...value.pronouns, id: uuidv4(), children: maybeGenericIDFromTree(value.pronouns.children) },
                    image: { ...value.image, id: value.image.data.key ? uuidv4() : '', children: maybeGenericIDFromTree(value.image.children) }
                }
            }
            return { ...value, id: uuidv4() }
        })
        this._assetKey = standard.key
        this._assetTag = standard.tag
        this._byId = byId
        this.metaData = maybeGenericIDFromTree(standard.metaData)
    }

    transform(callback: (schema: GenericTree<SchemaTag, TreeId>) => GenericTree<SchemaTag, TreeId>): StandardizerAbstract {
        const mappedByIdEntries = Object.entries(this._byId)
            .map(([key, value]) => ([{ [key]: transformStandardComponent(callback)(value) }]))
            .flat(1)
        const returnStandardizer = new StandardizerAbstract()
        returnStandardizer.loadStandardForm({
            byId: Object.assign({}, ...mappedByIdEntries),
            key: this._assetKey,
            tag: this._assetTag,
            metaData: this.metaData
        })
        return returnStandardizer
    }

    filter(args: Parameters<SchemaTagTree["filter"]>[0]): StandardizerAbstract {
        const callback = (schema: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => {
            const tagTree = new SchemaTagTree(schema)
            return maybeGenericIDFromTree(tagTree.filter(args).tree)
        }
        return this.transform(callback)
    }

    prune(args: Parameters<SchemaTagTree["prune"]>[0]): StandardizerAbstract {
        const callback = (schema: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => {
            const tagTree = new SchemaTagTree(schema)
            return maybeGenericIDFromTree(tagTree.prune(args).tree)
        }
        return this.transform(callback)
    }

    merge(incoming: StandardizerAbstract): StandardizerAbstract {
        const allKeys = unique(Object.keys(this._byId), Object.keys(incoming._byId))
        const combinedById = Object.assign({}, ...(allKeys.map((key) => {
            const rootComponent = this._byId[key]
            const incomingComponent = incoming._byId[key]
            if (rootComponent) {
                if (incomingComponent) {
                    return { [key]: mergeStandardComponents(rootComponent, incomingComponent) }
                }
                else {
                    return { [key]: rootComponent }
                }
            }
            else {
                return { [key]: incomingComponent }
            }
        })))

        const returnStandardizer = new StandardizerAbstract()
        returnStandardizer.loadStandardForm({
            byId: combinedById,
            key: this._assetKey,
            tag: this._assetTag,
            metaData: this.metaData
        })
        returnStandardizer._assetId = this._assetId === 'Test' ? incoming._assetId : this._assetId
        return returnStandardizer
    }
}
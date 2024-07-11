import { v4 as uuidv4 } from 'uuid'
import { deepEqual, objectFilter, objectMap } from "../lib/objects"
import { unique } from "../list"
import { selectKeysByTag } from "../normalize/selectors/keysByTag"
import { SchemaAssetTag, SchemaCharacterTag, SchemaDescriptionTag, SchemaExportTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaImportTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaWithKey, isSchemaAction, isSchemaTheme, isSchemaAsset, isSchemaBookmark, isSchemaCharacter, isSchemaComputed, isSchemaConditionStatement, isSchemaDescription, isSchemaExport, isSchemaFeature, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaOutputTag, isSchemaPronouns, isSchemaRoom, isSchemaShortName, isSchemaSummary, isSchemaTag, isSchemaVariable, isSchemaWithKey, isSchemaPrompt, isSchemaCondition, isSchemaConditionFallthrough, isSchemaExit } from "../schema/baseClasses"
import { unmarkInherited } from "../schema/treeManipulation/inherited"
import TagTree, { TagTreeMatchOperation } from "../tagTree"
import SchemaTagTree from "../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "../tree/baseClasses"
import { filter, treeTypeGuard } from "../tree/filter"
import { maybeGenericIDFromTree, stripIDFromTree } from "../tree/genericIDTree"
import { map } from "../tree/map"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, StandardForm, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardComponent } from "./baseClasses"
import { StandardizerAbstract } from './abstract'

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

export class Standardizer extends StandardizerAbstract {

    get byId(): StandardForm["byId"] {
        const byId: StandardForm["byId"] = Object.entries(this._byId)
            .reduce((previous, [key, value]) => {
                if (isStandardComponent(value)) {
                    return { ...previous, [key]: value }
                }
                return previous
            }, {})
        return byId
    }

    get stripped(): SerializableStandardForm {
        const byId: SerializableStandardForm["byId"] = objectMap(this.byId, (value) => {
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

    override get standardForm(): StandardForm {
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId: this.byId,
            metaData: this.metaData
        }
    }

}
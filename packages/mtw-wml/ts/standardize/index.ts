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
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, StandardForm, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardCharacter, isStandardAction, isStandardComputed, isStandardVariable, isStandardImage } from "./baseClasses"
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

    get stripped(): SerializableStandardForm {
        const byId: SerializableStandardForm["byId"] = objectMap(this._byId, (value) => {
            const stripId = <T extends StandardComponent>(value: T): Omit<T, 'id'> => {
                const { id, ...rest } = value
                return rest
            }
            const stripValue = <T extends StandardComponent, K extends keyof T, FilterType extends SchemaTag, InnerType extends SchemaTag>(item: T, key: K): NonNullable<T[K]> extends GenericTreeNodeFiltered<FilterType, InnerType, TreeId> ? GenericTreeNodeFiltered<FilterType, InnerType> : never => {
                const { id, ...subItem } = item[key] as GenericTreeNodeFiltered<FilterType, InnerType, TreeId>
                return { ...subItem, children: stripIDFromTree(subItem.children) } as NonNullable<T[K]> extends GenericTreeNodeFiltered<FilterType, InnerType, TreeId> ? GenericTreeNodeFiltered<FilterType, InnerType> : never
            }
            if (isStandardBookmark(value)) {
                return {
                    ...stripId(value),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [], id: '' }, 'description')
                }
            }
            if (isStandardFeature(value) || isStandardKnowledge(value)) {
                return {
                    ...stripId(value),
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [], id: '' }, 'name'),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [], id: '' }, 'description')
                }
            }
            if (isStandardMap(value)) {
                return {
                    ...stripId(value),
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [], id: '' }, 'name'),
                    positions: stripIDFromTree(value.positions),
                    images: stripIDFromTree(value.images),
                    themes: stripIDFromTree(value.themes).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (isStandardTheme(value)) {
                return {
                    ...stripId(value),
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [], id: '' }, 'name'),
                    prompts: stripIDFromTree(value.prompts).filter(treeNodeTypeguard(isSchemaPrompt)),
                    rooms: stripIDFromTree(value.rooms),
                    maps: stripIDFromTree(value.maps)
                }
            }
            if (isStandardRoom(value)) {
                return {
                    ...stripId(value),
                    shortName: stripValue(value ?? { data: { tag: 'ShortName' }, children: [], id: '' }, 'shortName'),
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [], id: '' }, 'name'),
                    summary: stripValue(value ?? { data: { tag: 'Summary' }, children: [], id: '' }, 'summary'),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [], id: '' }, 'description'),
                    exits: stripIDFromTree(value.exits),
                    themes: stripIDFromTree(value.themes).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (isStandardMessage(value)) {
                return {
                    ...stripId(value),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [], id: '' }, 'description'),
                    rooms: stripIDFromTree(value.rooms)
                }
            }
            if (isStandardMoment(value)) {
                return {
                    ...stripId(value),
                    messages: stripIDFromTree(value.messages)
                }
            }
            if (isStandardCharacter(value)) {
                return {
                    ...stripId(value),
                    pronouns: value.pronouns ?? { data: { tag: 'Pronouns', subject: '', object: '', adjective: '', possessive: '', reflexive: '' }, children: [], id: '' },
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [], id: '' }, 'name'),
                    firstImpression: stripValue(value ?? { data: { tag: 'FirstImpression' }, children: [], id: '' }, 'firstImpression'),
                    outfit: stripValue(value ?? { data: { tag: 'Outfit' }, children: [], id: '' }, 'outfit'),
                    oneCoolThing: stripValue(value ?? { data: { tag: 'OneCoolThing' }, children: [], id: '' }, 'oneCoolThing'),
                    image: stripValue(value ?? { data: { tag: 'Image' }, children: [], id: '' }, 'image')
                }
            }
            if (isStandardAction(value)) { return stripId(value) }
            if (isStandardComputed(value)) { return stripId(value) }
            if (isStandardVariable(value)) { return stripId(value) }
            if (isStandardImage(value)) { return stripId(value) }
            throw new Error('Unknown tag in Standardizer stripped')
        })
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId,
            metaData: stripIDFromTree(this.metaData)
        }
    }

}
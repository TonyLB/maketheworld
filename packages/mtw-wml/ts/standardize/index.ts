import { objectMap } from "../lib/objects"
import { SchemaTag, isSchemaTheme, isSchemaConditionStatement, isSchemaPrompt, isSchemaCondition, isSchemaConditionFallthrough } from "../schema/baseClasses"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../tree/baseClasses"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardCharacter, isStandardAction, isStandardComputed, isStandardVariable, isStandardImage, EditWrappedStandardNode } from "./baseClasses"
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

// const outputNodeToStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
//     node: GenericTreeNodeFiltered<T, SchemaTag> | undefined,
//     typeGuard: (value: SchemaTag) => value is ChildType,
//     defaultValue: T
// ): GenericTreeNodeFiltered<T, ChildType> => {
//     return node
//         ? { ...node, children: treeTypeGuard({ tree: defaultSelected(node.children), typeGuard }) }
//         : { data: defaultValue, children: [] }
// }

// const transformStandardItem = <T extends SchemaTag, ChildType extends SchemaTag>(
//     callback: (tree: GenericTree<SchemaTag>) => GenericTree<SchemaTag>,
//     typeGuard: (value: SchemaTag) => value is T,
//     childTypeGuard: (value: SchemaTag) => value is ChildType,
//     defaultValue: T
// ) => (node: EditWrappedStandardNode<T, SchemaTag> | undefined): EditWrappedStandardNode<T, ChildType> => {
//     const transformedTree = node ? callback([node]) : []
//     if (transformedTree.length === 0) {
//         return { data: defaultValue, children: [] }
//     }
//     const transformedNode = transformedTree[0]
//     if (transformedTree.length > 1 || !treeNodeTypeguard(typeGuard)(transformedNode)) {
//         throw new Error('Invalid return value in transformStandardItem')
//     }
//     return { ...transformedNode, children: treeTypeGuard({ tree: defaultSelected(transformedNode.children), typeGuard: childTypeGuard }) }
// }

export const serializedStandardItemToSchemaItem = (item: SerializableStandardComponent): GenericTreeNode<SchemaTag> => {
    switch(item.tag) {
        case 'Character':
            const { tag, ...pronouns } = item.pronouns.data
            return {
                data: { tag: 'Character', key: item.key, Pronouns: 'subject' in pronouns ? pronouns : { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
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
        const byId: SerializableStandardForm["byId"] = objectMap(this._byId, (value): SerializableStandardComponent => {
            const stripValue = <T extends StandardComponent, K extends keyof T, FilterType extends SchemaTag, InnerType extends SchemaTag>(item: T, key: K): NonNullable<T[K]> extends EditWrappedStandardNode<FilterType, InnerType> ? EditWrappedStandardNode<FilterType, InnerType, {}> : never => {
                return item[key] as NonNullable<T[K]> extends EditWrappedStandardNode<FilterType, InnerType> ? EditWrappedStandardNode<FilterType, InnerType, {}> : never
            }
            if (isStandardBookmark(value)) {
                return {
                    ...value,
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [] }, 'description')
                }
            }
            if (isStandardFeature(value) || isStandardKnowledge(value)) {
                return {
                    ...value,
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [] }, 'name'),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [] }, 'description')
                }
            }
            if (isStandardMap(value)) {
                return {
                    ...value,
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [] }, 'name'),
                    positions: value.positions,
                    images: value.images,
                    themes: (value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (isStandardTheme(value)) {
                return {
                    ...value,
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [] }, 'name'),
                    prompts: value.prompts.filter(treeNodeTypeguard(isSchemaPrompt)),
                    rooms: value.rooms,
                    maps: value.maps
                }
            }
            if (isStandardRoom(value)) {
                return {
                    ...value,
                    shortName: stripValue(value ?? { data: { tag: 'ShortName' }, children: [] }, 'shortName'),
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [] }, 'name'),
                    summary: stripValue(value ?? { data: { tag: 'Summary' }, children: [] }, 'summary'),
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [] }, 'description'),
                    exits: value.exits,
                    themes: (value.themes ?? []).filter(treeNodeTypeguard(isSchemaTheme))
                }
            }
            if (isStandardMessage(value)) {
                return {
                    ...value,
                    description: stripValue(value ?? { data: { tag: 'Description' }, children: [] }, 'description'),
                    rooms: value.rooms
                }
            }
            if (isStandardMoment(value)) {
                return {
                    ...value,
                    messages: value.messages
                }
            }
            if (isStandardCharacter(value)) {
                return {
                    ...value,
                    pronouns: stripValue(value, 'pronouns')  ?? { data: { tag: 'Pronouns', subject: '', object: '', adjective: '', possessive: '', reflexive: '' }, children: [] },
                    name: stripValue(value ?? { data: { tag: 'Name' }, children: [] }, 'name'),
                    firstImpression: stripValue(value ?? { data: { tag: 'FirstImpression' }, children: [] }, 'firstImpression'),
                    outfit: stripValue(value ?? { data: { tag: 'Outfit' }, children: [] }, 'outfit'),
                    oneCoolThing: stripValue(value ?? { data: { tag: 'OneCoolThing' }, children: [] }, 'oneCoolThing'),
                    image: stripValue(value ?? { data: { tag: 'Image' }, children: [] }, 'image')
                }
            }
            if (isStandardAction(value)) { return value }
            if (isStandardComputed(value)) { return value }
            if (isStandardVariable(value)) { return value }
            if (isStandardImage(value)) { return value }
            throw new Error('Unknown tag in Standardizer stripped')
        })
        return {
            key: this._assetKey,
            tag: this._assetTag,
            byId,
            metaData: this.metaData
        }
    }

}
import { objectMap } from "../lib/objects"
import { SchemaTag, isSchemaTheme, isSchemaConditionStatement, isSchemaPrompt, isSchemaCondition, isSchemaConditionFallthrough } from "../schema/baseClasses"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../tree/baseClasses"
import { SerializableStandardComponent, SerializableStandardForm, StandardComponent, isStandardTheme, isStandardBookmark, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardCharacter, isStandardAction, isStandardComputed, isStandardVariable, isStandardImage, EditWrappedStandardNode } from "./baseClasses"
import { StandardizerAbstract } from './abstract'
import { excludeUndefined } from "../lib/lists"

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

export const standardItemToSchemaItem = (item: StandardComponent): GenericTreeNode<SchemaTag> => {
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

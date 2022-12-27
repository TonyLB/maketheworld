import { deepEqual } from "../../lib/objects";
import { NormalConditionStatement } from "../../normalize/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"

export type OrderedConditionalNode = {
    conditions: NormalConditionStatement[];
    contents: OrderedConditionalTree;
}

export type OrderedConditionalTree = (SchemaTag | OrderedConditionalNode)[]

export type FlattenedConditionalNode = {
    conditions: NormalConditionStatement[];
    contents: SchemaTag[];
}

const isConditionNode = (value: SchemaTag | OrderedConditionalNode): value is OrderedConditionalNode => (!('tag' in value))

const lastNode = (list: FlattenedConditionalNode[]): FlattenedConditionalNode | undefined => {
    if (list.length === 0) {
        return undefined
    }
    else {
        return list.slice(-1)[0]
    }
}

//
// flattenOrderedConditionalTree transforms an OrderedConditionalTree to a functionally equivalent FlattenedConditionalNode
// by depth-first walking the tree and outputting each different set of conditions as its own FlattenedConditionalNode in order
//
export const flattenOrderedConditionalTreeReducer = (previous: FlattenedConditionalNode[], context: NormalConditionStatement[], tree: OrderedConditionalTree): FlattenedConditionalNode[] => {
    return tree.reduce<FlattenedConditionalNode[]>((accumulator, node) => {
        if (isConditionNode(node)) {
            return flattenOrderedConditionalTreeReducer(
                accumulator,
                [ ...context, ...node.conditions ],
                node.contents
            )
        }
        else {
            const previousItem = lastNode(accumulator)
            if (previousItem && deepEqual(previousItem.conditions, context)) {
                return [
                    ...(previous.slice(0, -1)),
                    {
                        conditions: context,
                        contents: [
                            ...previousItem.contents,
                            node
                        ]
                    }
                ]
            }
            else {
                return [
                    ...accumulator,
                    {
                        conditions: context,
                        contents: [node]
                    }
                ]
            }
        }
    }, previous)
}

export const flattenOrderedConditionalTree = (tree: OrderedConditionalTree): FlattenedConditionalNode[] => (flattenOrderedConditionalTreeReducer([], [], tree))

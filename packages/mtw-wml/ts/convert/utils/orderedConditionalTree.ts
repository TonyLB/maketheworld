import { deepEqual } from "../../lib/objects"
import { NormalConditionStatement } from "../../normalize/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"
import IndexSubstitution from "./indexSubstitution"
import shortestCommonSupersequence from "./shortestCommonSupersequence"

export type OrderedConditionalNode = {
    conditions: NormalConditionStatement[];
    contents: OrderedConditionalTree;
}

export type OrderedConditionalTree = (SchemaTag | OrderedConditionalNode)[]

export type FlattenedConditionalNode = {
    conditions: NormalConditionStatement[];
    contents: SchemaTag[];
}

export type FlattenedIndexedConditionalNode = {
    conditionIndices: number[];
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

//
// unflattenOrderedConditionalTreeReducer creates a first pass by joining all conditionals in a tree where
// each conditional node has only a single condition
//
const unflattenOrderedConditionalTreeReducer = (previous: OrderedConditionalTree, item: FlattenedConditionalNode): OrderedConditionalTree => {
    //
    // For an unconditioned item, add SchemaTag contents directly to the tree
    //
    if (item.conditions.length === 0) {
        return [
            ...previous,
            ...item.contents
        ]
    }
    //
    // Otherwise, parse down as much commonality as you can on conditions, and branch
    // from there
    //
    else {
        const previousNode = previous.length > 0 ? previous.slice(-1)[0] : undefined
        if (previousNode && isConditionNode(previousNode) && deepEqual(previousNode.conditions[0], item.conditions[0])) {
            //
            // Recurse further into the structure of the most recent node rather than creating a new branch here
            //
            return [
                ...previous.slice(0, -1),
                {
                    conditions: previousNode.conditions,
                    contents: unflattenOrderedConditionalTreeReducer(previousNode.contents, { ...item, conditions: item.conditions.slice(1) })
                }
            ]
        }
        else {
            //
            // Create a new branch from here
            //
            return [
                ...previous,
                {
                    conditions: [item.conditions[0]],
                    contents: unflattenOrderedConditionalTreeReducer([], { ...item, conditions: item.conditions.slice(1) })
                }
            ]
        }
    }
}

const maybeCollapseNode = (node: OrderedConditionalNode): OrderedConditionalNode => {
    if (isConditionNode(node)) {
        if (isConditionNode(node) && node.contents.length === 1 && isConditionNode(node.contents[0])) {
            const collapsedSubNode = maybeCollapseNode(node.contents[0])
            return {
                conditions: [
                    ...node.conditions,
                    ...collapsedSubNode.conditions
                ],
                contents: collapsedSubNode.contents
            }
        }
        else {
            return {
                conditions: node.conditions,
                contents: node.contents.map(maybeCollapseNode)
            }
        }
    }
    else {
        return node
    }
}

export const unflattenOrderedConditionalTree = (list: FlattenedConditionalNode[]): OrderedConditionalTree => {
    return list
        .reduce<OrderedConditionalTree>(unflattenOrderedConditionalTreeReducer, [])
        .map(maybeCollapseNode)
}

const indexFlattenedConditionalNodes = (indexSubstitution: IndexSubstitution<NormalConditionStatement>) => (list: FlattenedConditionalNode[]): FlattenedIndexedConditionalNode[] => {
    return list.map(({ conditions, contents }) => ({
        conditionIndices: conditions.map((condition) => (indexSubstitution.toIndex(condition))),
        contents
    }))
}

const deindexFlattenedConditionalNodes = (indexSubstitution: IndexSubstitution<NormalConditionStatement>) => (list: FlattenedIndexedConditionalNode[]): FlattenedConditionalNode[] => {
    return list.map(({ conditionIndices, contents }) => ({
        conditions: conditionIndices.map((index) => (indexSubstitution.fromIndex(index))),
        contents
    }))
}

//
// navigationSequence turns a list of tree-locations (as defined by a list of numeric values) into a sequence of navigation
// points, starting from the root (empty list) and showing each node traversal (as a tree-location) moving up and down
// the tree from one point to another, including a final traversal back up the tree to root at the end.
//
type NavigationSequenceReducerOutput = {
    from: number[];
    returnSequence: number[][]
}
const navigationSequenceReducer = (previous: number[][], to: number[] ): number[][] => {
    let returnSequence = [...previous]
    let currentSequence = returnSequence.slice(-1)[0]
    //
    // First navigate up the sequence to the common branching point
    //
    const lastCommonIndex = currentSequence.reduce((output, value, index) => {
        if (output === index - 1 && to.length > index && to[index] === value) {
            return index
        }
        return output
    }, -1)
    while(lastCommonIndex + 1 < currentSequence.length) {
        currentSequence.pop()
        returnSequence.push(currentSequence)
    }
    //
    // Then navigate back down to the new point
    //
    while(to.length > currentSequence.length) {
        currentSequence.push(to[currentSequence.length])
        returnSequence.push(currentSequence)
    }
    return returnSequence
}

export const navigationSequence = (tree: number[][]): number[][] => {
    const returnSequence = [...tree, []].reduce<number[][]>(navigationSequenceReducer, [[]])
    return returnSequence
}

//
// TODO: Extend mergeOrderedConditionalTrees to (a) accept unlimited trees as arguments and reduce sequentially, (b) remove repetition of TreeA, TreeB
//
export const mergeOrderedConditionalTrees = (treeA: OrderedConditionalTree | FlattenedConditionalNode[], treeB: OrderedConditionalTree | FlattenedConditionalNode[]): OrderedConditionalTree => {
    const isFlattened = (tree: OrderedConditionalTree | FlattenedConditionalNode[]): tree is FlattenedConditionalNode[] => (!Boolean(tree.find((node) => (isConditionNode(node)))))
    const flattenedTreeA = isFlattened(treeA) ? treeA : flattenOrderedConditionalTree(treeA)
    const flattenedTreeB = isFlattened(treeB) ? treeB : flattenOrderedConditionalTree(treeB)
    const treeConditionSubstitutions = new IndexSubstitution<NormalConditionStatement>(deepEqual)
    const indexedTreeA = indexFlattenedConditionalNodes(treeConditionSubstitutions)(flattenedTreeA)
    const indexedTreeB = indexFlattenedConditionalNodes(treeConditionSubstitutions)(flattenedTreeB)
    const navigationSequenceSubstitutions = new IndexSubstitution<number[]>(deepEqual)
    const navigationTreeA = navigationSequence(indexedTreeA.map(({ conditionIndices }) => (conditionIndices))).map((sequence) => (navigationSequenceSubstitutions.toIndex(sequence)))
    const navigationTreeB = navigationSequence(indexedTreeB.map(({ conditionIndices }) => (conditionIndices))).map((sequence) => (navigationSequenceSubstitutions.toIndex(sequence)))
    const commonNavigationSequence = shortestCommonSupersequence(navigationTreeA, navigationTreeB)
    //
    // TODO: Parse through the common supersequence, and keep a pointer into each of the two existing trees,
    // and map back the navigation sequences to their appearance in each list, in order to pull the tree data
    // into a combined tree
    //
    let indexA = 0, indexB = 0
    const combinedIndexedTree = commonNavigationSequence.reduce<FlattenedIndexedConditionalNode[]>((previous, navigationIndex) => {
        return previous
    }, [])

    return []
}

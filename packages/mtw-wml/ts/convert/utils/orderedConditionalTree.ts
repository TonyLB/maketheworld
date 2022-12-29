import { current } from "immer"
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
                    ...(accumulator.slice(0, -1)),
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
// TODO: Sibling adjacency is not counted intuitively by navigationSequence (it counts a sibling traversal as being two steps,
// one up and one down).  See if there are other navigationSequence metrics that return more natural results
//

//
// navigationSequence turns a list of tree-locations (as defined by a list of numeric values) into a sequence of navigation
// points, starting from the root (empty list) and showing each node traversal (as a tree-location) moving up and down
// the tree from one point to another, including a final traversal back up the tree to root at the end.
//
const navigationSequenceReducer = (previous: number[][], to: number[] ): number[][] => {
    let returnSequence = [...previous]
    let currentSequence = [...returnSequence.slice(-1)[0]]
    //
    // First navigate up the sequence to one level *below* the common branching point
    //
    const lastCommonIndex = currentSequence.reduce((output, value, index) => {
        if (output === index - 1 && to.length > index && to[index] === value) {
            return index
        }
        return output
    }, -1)
    enum navigationSequenceDirection {
        up,
        down,
        sibling
    }
    const navigate = (direction: navigationSequenceDirection): void => {
        switch(direction) {
            case navigationSequenceDirection.up:
                currentSequence.pop()
                break
            case navigationSequenceDirection.sibling:
                currentSequence.pop()
            case navigationSequenceDirection.down:
                currentSequence.push(to[currentSequence.length])
        }
    }
    while(lastCommonIndex + 2 < currentSequence.length) {
        navigate(navigationSequenceDirection.up)
        returnSequence.push([...currentSequence])
    }
    //
    // If the navigation requires both navigating up *and* down than execute the one sibling-step
    // sideways as a single step rather than "double-charge" sibling adjacency in a way that
    // would discourage grouping sibling records
    //
    if (lastCommonIndex + 1 < currentSequence.length) {
        if (to.length > lastCommonIndex + 1) {
            navigate(navigationSequenceDirection.sibling)
            returnSequence.push([...currentSequence])
        }
        else {
            navigate(navigationSequenceDirection.up)
            returnSequence.push([...currentSequence])
        }
    }

    //
    // Then (if needed) navigate back down to the new point
    //
    while(to.length > currentSequence.length) {
        navigate(navigationSequenceDirection.down)
        returnSequence.push([...currentSequence])
    }
    return returnSequence
}

export const navigationSequence = (tree: number[][]): number[][] => {
    const returnSequence = [...tree, []].reduce<number[][]>(navigationSequenceReducer, [[]])
    return returnSequence
}

export const mergeOrderedConditionalTrees = (...trees: (OrderedConditionalTree | FlattenedConditionalNode[])[]): OrderedConditionalTree => {
    const isFlattened = (tree: OrderedConditionalTree | FlattenedConditionalNode[]): tree is FlattenedConditionalNode[] => {
        const returnValue = tree.find(
            (node: OrderedConditionalNode | SchemaTag | FlattenedConditionalNode) => (
                'tag' in node ||
                ('contents' in node && node.contents.find((subNode) => (!('tag' in subNode))))
            )
        )
        return !Boolean(returnValue)
    }
    const flattenedTrees = trees.map((tree) => (isFlattened(tree) ? tree : flattenOrderedConditionalTree(tree)))
    //
    // For each tree in the list, indexedTrees replaces the list of explicit conditions with numeric conditionIndices that can be
    // equality tested, and can be used as a key into the treeConditionSubstitutions object to return the original explicit
    // conditions when they are needed again after sorting and merging.
    //
    const treeConditionSubstitutions = new IndexSubstitution<NormalConditionStatement>(deepEqual)
    const indexedTrees = flattenedTrees.map((tree) => (indexFlattenedConditionalNodes(treeConditionSubstitutions)(tree)))
    //
    // For each tree in the list, navigationIndexedTrees replaces the list of conditionIndices with a single key from the navigationSequenceSubstitutions.
    // This is too _little_ information to do a proper mapping of the trees together (since it loses the relation of branches to each other), but is
    // enough to match against the commonNavigationSequence that will be created later.
    //
    const navigationSequenceSubstitutions = new IndexSubstitution<number[]>(deepEqual)
    const navigationIndexedTrees = indexedTrees.map((tree) => (tree.map(({ conditionIndices, contents }) => ({ conditionSequence: navigationSequenceSubstitutions.toIndex(conditionIndices), contents }))))
    //
    // Now we return to the indexed conditions (which still have tree-hierarchy information) in order to calculate the navigation sequences
    // that define the structure, and add them to the equality-testable mapping in navigationSequenceSubstitutions.
    //
    const navigationSequencedTrees = indexedTrees.map((tree) => (navigationSequence(tree.map(({ conditionIndices }) => (conditionIndices))).map((sequence) => (navigationSequenceSubstitutions.toIndex(sequence)))))
    const commonNavigationSequence = navigationSequencedTrees.reduce<number[]>((previous, next) => (shortestCommonSupersequence(previous, next)), [])
    //
    // Parse through the common supersequence, and keep a pointer into each of the existing trees,
    // and as navigationIndexes in the supersequence match each tree, add the deindexed data into the
    // final merged output
    //
    const flattenedOutput: FlattenedConditionalNode[] = []
    const currentPositions: number[] = Array(trees.length).fill(0)
    commonNavigationSequence.forEach((currentSequence) => {
        for(let whichTree=0; whichTree < trees.length; whichTree++) {
            const currentNavigationTree = navigationIndexedTrees[whichTree]
            while(currentPositions[whichTree] < currentNavigationTree.length && currentNavigationTree[currentPositions[whichTree]].conditionSequence === currentSequence) {
                flattenedOutput.push({
                    conditions: navigationSequenceSubstitutions.fromIndex(currentSequence).map((index) => (treeConditionSubstitutions.fromIndex(index))),
                    contents: currentNavigationTree[currentPositions[whichTree]].contents
                })
                currentPositions[whichTree]++
            }
        }
    })
    if (currentPositions.find((finalIndex, whichTree) => (finalIndex < navigationIndexedTrees[whichTree].length))) {
        throw new Error('mergeOrderedConditionalTree error:  Navigation Supersequence failed to contain all sub-entries')
    }
    return unflattenOrderedConditionalTree(flattenedOutput)
}

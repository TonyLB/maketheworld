//
// TODO: Create converter function that reduces a list of exits into a tree of nodes with (a) a list of
// exits at that node, and (b) a list of If clusters (1 If, zero or more ElseIfs, zero or one Else), each
// their own node.
//

import { isNormalCondition, isNormalExit, NormalCondition, NormalConditionStatement, NormalForm, NormalItem, NormalReference } from "@tonylb/mtw-wml/dist/normalize/baseClasses";
import { deepEqual } from "../../../lib/objects";
import { addItem } from "../../../slices/activeCharacters";
import { noConditionContext } from "./utilities";

type ConditionalTreeNode<T extends NormalItem> = {
    if: {
        source: string;
        node: ConditionalTree<T>;
    };
    elseIfs: {
        source: string;
        node: ConditionalTree<T>;
    }[];
    else?: ConditionalTree<T>;
}

export type ConditionalTree<T extends NormalItem> = {
    items: T[];
    conditionals: ConditionalTreeNode<T>[];
}

const mergeItem = <T extends NormalItem>(compare: (A: T, B: T) => boolean ) => (previous: (T)[], item: T): (T)[] => {
    if (previous.find((check) => (compare(check, item)))) {
        return previous
    }
    else {
        return [
            ...previous,
            item
        ]
    }
}

type MatchExistingTreeOutput = {
    type: 'If';
} | {
    type: 'ElseIf';
    index: number;
} | {
    type: 'NewElseIf';
    additionalConditions: string[];
} | {
    type: 'Else';
} | {
    type: 'NewElse';
    additionalConditions: string[];
}

const matchExistingTree = <T extends NormalItem>(node: ConditionalTreeNode<T>, { conditions }: NormalCondition): MatchExistingTreeOutput | undefined => {
    const hasSource = Boolean(conditions.find(({ not }) => (!not)))
    const extendsConditions = conditions.length > node.elseIfs.length + 1
    if (extendsConditions) {
        //
        // The existing chain of elseIfs must all match against the incoming conditions, or there is no match
        //
        if (!deepEqual(conditions.slice(0, node.elseIfs.length + 1).map(({ if: source }) => (source)), [node.if.source, ...node.elseIfs.map(({ source }) => (source))])) {
            return undefined
        }
        const additionalConditions = conditions.slice(node.elseIfs.length + 1).map(({ if: source }) => (source))
        if (hasSource) {
            return { type: 'NewElseIf', additionalConditions }
        }
        else {
            return { type: 'NewElse', additionalConditions }
        }
    }
    else {
        //
        // The incoming conditions must all match against the existing chain of elseIfs, or there is no match
        //
        if (!deepEqual(conditions.map(({ if: source }) => (source)), [node.if.source, ...node.elseIfs.map(({ source }) => (source))].slice(0, conditions.length))) {
            return undefined
        }
        if (conditions.length === 1 && hasSource) {
            return { type: 'If' }
        }
        if (!hasSource && conditions.length < node.elseIfs.length) {
            //
            // Cannot break off for an unconditioned Else in the middle of this ElseIf chain
            //
            return undefined
        }
        if (hasSource) {
            return { type: 'ElseIf', index: conditions.length - 1 }
        }
        else {
            return { type: 'Else' }
        }
    }
}

const addItemToTreeInContext = <T extends NormalItem>(compare: (A: T, B: T) => boolean, normalForm: NormalForm ) => (previous: ConditionalTree<T>, { item, contextStack }: { item: T, contextStack: NormalReference[] }): ConditionalTree<T> => {
    if (contextStack.length)  {
        const firstCondition = normalForm[contextStack[0].key]
        if (firstCondition && isNormalCondition(firstCondition)) {
            const matchRecord = previous.conditionals.reduce<{ index: number; match: MatchExistingTreeOutput } | undefined>((accumulator, node, index) => {
                if (!accumulator) {
                    const match = matchExistingTree(node, firstCondition)
                    if (match) {
                        return { index, match }
                    }
                }
                return accumulator
            }, undefined)
            const newArg = { item, contextStack: contextStack.slice(1) }
            if (matchRecord) {
                //
                // Add new conditions to the current node if needed
                //
                const { index, match } = matchRecord
                let newNode = previous.conditionals[index]
                switch(match.type) {
                    case 'If':
                        newNode = {
                            ...newNode,
                            if: {
                                ...newNode.if,
                                node: addItemToTreeInContext(compare, normalForm)(newNode.if.node, newArg)
                            }
                        }
                        break
                    case 'Else':
                        newNode = {
                            ...newNode,
                            else: addItemToTreeInContext(compare, normalForm)(newNode.else ?? { items: [], conditionals: [] }, newArg)
                        }
                        break
                    case 'ElseIf':
                        newNode = {
                            ...newNode,
                            elseIfs: [
                                ...newNode.elseIfs.slice(0, match.index),
                                {
                                    ...newNode.elseIfs[match.index],
                                    node: addItemToTreeInContext(compare, normalForm)(newNode.elseIfs[match.index].node, newArg)
                                }
                            ]
                        }
                        break
                    case 'NewElse':
                        newNode = {
                            ...newNode,
                            elseIfs: [
                                ...newNode.elseIfs,
                                ...match.additionalConditions.map((source) => ({ source, node: { items: [], conditionals: []  }}))
                            ],
                            else: addItemToTreeInContext(compare, normalForm)({ items: [], conditionals: [] }, newArg)
                        }
                        break
                    case 'NewElseIf':
                        newNode = {
                            ...newNode,
                            elseIfs: [
                                ...newNode.elseIfs,
                                ...match.additionalConditions.slice(0, -1).map((source) => ({ source, node: { items: [], conditionals: []  }})),
                                {
                                    source: match.additionalConditions.slice(-1)[0],
                                    node: addItemToTreeInContext(compare, normalForm)({ items: [], conditionals: [] }, newArg)
                                }
                            ]
                        }
                }
                return {
                    ...previous,
                    conditionals: [
                        ...previous.conditionals.slice(0, index),
                        newNode,
                        ...previous.conditionals.slice(index + 1)
                    ]
                }
            }
            else {
                //
                // Create a new condition node with matching structures
                //
                const { conditions } = firstCondition
                if (conditions.length) {
                    const hasSource = Boolean(conditions.find(({ not }) => (!not)))
                    let newNode: ConditionalTreeNode<T>
                    if (hasSource) {
                        if (conditions.length > 1) {
                            newNode = {
                                if: {
                                    source: conditions[0].if,
                                    node: {
                                        items: [],
                                        conditionals: []
                                    }
                                },
                                elseIfs: [
                                    ...conditions.slice(1, -1).map(({ if: ifPredicate }) => ({
                                        source: ifPredicate,
                                        node: {
                                            items: [],
                                            conditionals: []
                                        }
                                    })),
                                    {
                                        source: conditions.slice(-1)[0].if,
                                        node: addItemToTreeInContext(compare, normalForm)({ items: [], conditionals: [] }, newArg)
                                    }
                                ]
                            }
                        }
                        else {
                            newNode = {
                                if: {
                                    source: conditions[0].if,
                                    node: addItemToTreeInContext(compare, normalForm)({ items: [], conditionals: [] }, newArg)
                                },
                                elseIfs: []
                            }
                        }
                    }
                    else {
                        newNode = {
                            if: {
                                source: conditions[0].if,
                                node: {
                                    items: [],
                                    conditionals: []
                                }
                            },
                            elseIfs: conditions.slice(1).map(({ if: ifPredicate }) => ({
                                source: ifPredicate,
                                node: {
                                    items: [],
                                    conditionals: []
                                }
                            })),
                            else: addItemToTreeInContext(compare, normalForm)({ items: [], conditionals: [] }, newArg)
                        }
                    }
                    return {
                        ...previous,
                        conditionals: [
                            ...previous.conditionals,
                            newNode
                        ]
                    }
                }
            }
        }
        return previous
    }
    else {
        return {
            ...previous,
            items: mergeItem(compare)(previous.items, item)
        }
    }
}

const recursiveSimplifyConditionTree = <T extends NormalItem>(tree: ConditionalTree<T>): any => ({
    items: tree.items.map((item) => (isNormalExit(item) ? item.name : '')),
    conditionals: tree.conditionals.map(({ if: ifPredicate, elseIfs, else: elsePredicate }) => ({
        if: {
            source: ifPredicate.source,
            node: recursiveSimplifyConditionTree(ifPredicate.node)
        },
        elseIfs: elseIfs.map(({ source, node }) => ({
            source,
            node: recursiveSimplifyConditionTree(node)
        })),
        else: elsePredicate ? recursiveSimplifyConditionTree(elsePredicate) : undefined
    }))
})

export const reduceItemsToTree = <T extends NormalItem>(compare: (A: T, B: T) => boolean, normalForm: NormalForm) => (previous: ConditionalTree<T>, item: T): ConditionalTree<T> => {
    if ((item.appearances ?? []).find(noConditionContext)) {
        return {
            ...previous,
            items: mergeItem(compare)(previous.items, item)
        }
    }
    else {
        return (item.appearances ?? [])
            .map(({ contextStack }) => ({ item, contextStack: contextStack.filter(({ tag }) => (tag === 'If')) }))
            .reduce<ConditionalTree<T>>((previous, item) => (addItemToTreeInContext(compare, normalForm)(previous, item)), previous)
    }
}

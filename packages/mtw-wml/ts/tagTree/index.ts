import { deepEqual } from "../lib/objects";
import { unique } from "../list";
import { GenericTree, GenericTreeNode } from "../sequence/tree/baseClasses"
import dfsWalk from "../sequence/tree/dfsWalk"

type TagTreeTreeOptions<NodeData extends {}, Extra extends {} = {}> = {
    classify: (data: NodeData) => string;
    compare?: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => boolean;
    merge?: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => ({ data: NodeData } & Extra);
    orderIndependence?: string[][];
}

type TagTreeMatchOperand<NodeData extends {}, Extra extends {} = {}> = 
    string |
    ({ data: NodeData } & Extra) |
    { (value: { data: NodeData } & Extra): boolean }

type TagTreeMatchSequence<NodeData extends {}, Extra extends {} = {}> = {
    sequence: TagTreeMatchOperation<NodeData, Extra>[]
}

type TagTreeMatchAfter<NodeData extends {}, Extra extends {} = {}> = {
    after: TagTreeMatchOperation<NodeData, Extra>
}

type TagTreeMatchBefore<NodeData extends {}, Extra extends {} = {}> = {
    before: TagTreeMatchOperation<NodeData, Extra>
}

type TagTreeMatchExact<NodeData extends {}, Extra extends {} = {}> = {
    match: TagTreeMatchOperand<NodeData, Extra>
}

type TagTreeMatchNot<NodeData extends {}, Extra extends {} = {}> = {
    not: TagTreeMatchOperation<NodeData, Extra>
}

type TagTreeMatchAnd<NodeData extends {}, Extra extends {} = {}> = {
    and: TagTreeMatchOperation<NodeData, Extra>[]
}

type TagTreeMatchOr<NodeData extends {}, Extra extends {} = {}> = {
    or: TagTreeMatchOperation<NodeData, Extra>[]
}

export type TagTreeMatchOperation<NodeData extends {}, Extra extends {} = {}> =
    TagTreeMatchSequence<NodeData, Extra> |
    TagTreeMatchAfter<NodeData, Extra> |
    TagTreeMatchBefore<NodeData, Extra> |
    TagTreeMatchExact<NodeData, Extra> |
    TagTreeMatchNot<NodeData, Extra> |
    TagTreeMatchAnd<NodeData, Extra> |
    TagTreeMatchOr<NodeData, Extra>

export type TagListItem<NodeData extends {}, Extra extends {} = {}> = {
    data: NodeData;
} & Extra

type TagTreeActionReorder = { reorder: string[] }
type TagTreeActionFilter<NodeData extends {}, Extra extends {} = {}> = { filter: TagTreeFilterArguments<NodeData, Extra> }

export type TagTreeAction<NodeData extends {}, Extra extends {} = {}> =
    TagTreeActionReorder |
    TagTreeActionFilter<NodeData, Extra>

const isTagTreeActionReorder = <NodeData extends {}, Extra extends {} = {}>(action: TagTreeAction<NodeData, Extra>): action is TagTreeActionReorder => ('reorder' in action)
const isTagTreeActionFilter = <NodeData extends {}, Extra extends {} = {}>(action: TagTreeAction<NodeData, Extra>): action is TagTreeActionFilter<NodeData, Extra> => ('filter' in action)

type TagTreeFilterArguments<NodeData extends {}, Extra extends {} = {}> = (TagTreeMatchExact<NodeData, Extra> | TagTreeMatchNot<NodeData, Extra> | TagTreeMatchAnd<NodeData, Extra> | TagTreeMatchOr<NodeData, Extra>)
const isTagTreeFilterArgument = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperation<NodeData, Extra>): arg is TagTreeFilterArguments<NodeData, Extra> => {
    return ('not' in arg || 'and' in arg || 'or' in arg || 'match' in arg)
}
// const isTagTreeNodeDataOperandNested = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperand<NodeData, Extra>): arg is { data: NodeData } & Extra => (typeof arg === 'object' && 'data' in arg)
// const isTagTreeNodeDataOperandUnnested = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperand<NodeData, Extra>): arg is NodeData => (typeof arg === 'object' && !('data' in arg))

type TagTreePruneArgs<NodeData extends {}, Extra extends {} = {}> = TagTreeMatchOperation<NodeData, Extra>

export const tagListFromTree = <NodeData extends {}, Extra extends {} = {}>(tree: GenericTree<NodeData, Extra>): TagListItem<NodeData, Extra>[][] => {
    return dfsWalk({
        default: { output: [], state: {} },
        callback: (previous: { output: TagListItem<NodeData, Extra>[][], state: {} }, data: NodeData, extra: Extra) => {
            return { output: [...previous.output, [{ data, ...extra }]], state: {} }
        },
        aggregate: ({ direct, children, data, extra }) => {
            return {
                output: [
                    ...(children.output.length ? direct.output.slice(0, -1) : direct.output),
                    ...children.output.map((nodes) => ([...(data ? [{ data, ...(extra as unknown as Extra) }] : []), ...nodes]))
                ],
                state: {}
            }
        }
    })(tree)
}

export const iterativeMerge = <NodeData extends {}, Extra extends {} = {}>(options: TagTreeTreeOptions<NodeData, Extra>) => (previous: GenericTree<NodeData, Extra>, tagItem: TagListItem<NodeData, Extra>[]): GenericTree<NodeData, Extra> => {
    if (!tagItem.length) {
        return previous
    }
    const compare = options.compare ?? deepEqual
    const merge: (A: TagListItem<NodeData, Extra>, B: TagListItem<NodeData, Extra>) => TagListItem<NodeData, Extra> = options.merge ?? ((A, B) => ({ ...A, data: { ...A.data, ...B.data } }))
    if (previous.length) {
        const classOne = options.classify(tagItem[0].data)
        const { matchIndex } = previous.reduceRight<{ matchIndex?: number; noMatch?: boolean }>((matchReduce, { data, children, ...rest }, index) => {
            //
            // If a result has already been found then continue to the exit of the loop
            //
            if ((typeof matchReduce.matchIndex !== 'undefined') || matchReduce.noMatch) {
                return matchReduce
            }
            //
            // If this current data point *is* the match, return that index
            //
            if (compare({ data, ...(rest as unknown as Extra) }, tagItem[0])) {
                return { matchIndex: index }
            }
            const classTwo = options.classify(data)
            //
            // Otherwise, if this element is one that can be merged past because of
            // order independence then continue the search
            //
            if ((options.orderIndependence ?? []).find((independenceGroup) => (
                independenceGroup.includes(classOne) && independenceGroup.includes(classTwo)
            ))) {
                return matchReduce
            }
            //
            // Or else, return a guaranteed non-match
            //
            else {
                return { noMatch: true }
            }
        }, {})
        if (typeof matchIndex !== 'undefined') {
            const { data, children, ...rest } = previous[matchIndex]
            return [
                ...previous.slice(0, matchIndex),
                { ...(merge({ data, ...rest } as unknown as TagListItem<NodeData, Extra>, tagItem[0])), children: iterativeMerge(options)(previous[matchIndex].children, tagItem.slice(1)) },
                ...previous.slice(matchIndex + 1)
            ]
        }
    }
    return [...previous, { ...tagItem[0], children: iterativeMerge(options)([], tagItem.slice(1)) }]
}


export class TagTree<NodeData extends {}, Extra extends {} = {}> {
    _tagList: TagListItem<NodeData, Extra>[][];
    _compare: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => boolean;
    _classifier: (data: NodeData) => string;
    _orderIndependence: string[][];
    _merge?: (A: TagListItem<NodeData, Extra>, B: TagListItem<NodeData, Extra>) => TagListItem<NodeData, Extra>
    _actions: TagTreeAction<NodeData, Extra>[] = [];

    constructor(args: { tree: GenericTree<NodeData, Extra> } & TagTreeTreeOptions<NodeData, Extra>) {
        this._classifier = args.classify
        this._orderIndependence = args.orderIndependence ?? []
        this._compare = args.compare ?? deepEqual
        this._merge = args.merge
        this._tagList = tagListFromTree(args.tree)
    }

    get tree() {
        return this._transformedTags.reduce<GenericTree<NodeData, Extra>>(iterativeMerge<NodeData, Extra>({ classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence, merge: this._merge }), [])
    }

    //
    // Create a new TagTree with tags ordered (and therefore grouped) in a new way. The orderGroups will specify
    // how to internally reorder tags.
    //
    _reorderTags(order: string[]) {
        return (tags: TagListItem<NodeData, Extra>[]): number[] => {
            const returnValue = tags.reduce<number[]>((previous, node, index) => {
                const orderIndex = order.indexOf(this._classifier(node.data))
                const sortBeforeList = orderIndex === -1 ? [] : order.slice(orderIndex + 1)
                if (sortBeforeList.length) {
                    const sortBeforeIndex = previous.findIndex((index) => (sortBeforeList.includes(this._classifier(tags[index].data))))
                    if (sortBeforeIndex !== -1) {
                        return [
                            ...previous.slice(0, sortBeforeIndex),
                            index,
                            ...previous.slice(sortBeforeIndex)
                        ]
                    }
                }
                return [...previous, index]
            }, [])
            return returnValue
        }
    }

    _filterTags(args: TagTreeFilterArguments<NodeData, Extra>) {
        return (tags: TagListItem<NodeData, Extra>[]): Boolean => {
            const returnValue = new TagTree<NodeData, Extra>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })
            //
            // Recursive match between tagList and a (possibly recursive) MatchOperator
            //
            const filterMatch = (arg: TagTreeFilterArguments<NodeData, Extra>, tagList: TagListItem<NodeData, Extra>[]): Boolean => {
                if ('not' in arg) {
                    if (isTagTreeFilterArgument(arg.not)) {
                        return !filterMatch(arg.not, tagList)
                    }
                    else {
                        return false
                    }
                }
                if ('and' in arg) {
                    return arg.and
                        .filter(isTagTreeFilterArgument)
                        .reduce<Boolean>((previous, subArg) => (previous && filterMatch(subArg, tagList)), true)
                }
                if ('or' in arg) {
                    return arg.or
                        .filter(isTagTreeFilterArgument)
                        .reduce<Boolean>((previous, subArg) => (previous || filterMatch(subArg, tagList)), false)
                }
                if ('match' in arg) {
                    const nodeMatches = this._tagMatchOperationIndices(tagList, arg)
                    return nodeMatches.length > 0
                }
                return false
            }
            return filterMatch(args, tags)
        }
    }

    get _transformedTags(): TagListItem<NodeData, Extra>[][] {
        return this._actions.reduce<TagListItem<NodeData, Extra>[][]>((previous, action) => {
            if (isTagTreeActionReorder(action)) {
                const reorderedTags = previous.map((tagList) => (this._reorderTags(action.reorder)(tagList).map((index) => (tagList[index]))))
                return reorderedTags
            }
            if (isTagTreeActionFilter(action)) {
                const filteredTags = previous.filter(this._filterTags(action.filter))
                return filteredTags
            }
            return previous
        }, this._tagList)
    }

    clone(): TagTree<NodeData, Extra> {
        const returnValue = new TagTree<NodeData, Extra>({ tree: [], classify: this._classifier, compare: this._compare, merge: this._merge, orderIndependence: this._orderIndependence })
        returnValue._tagList = this._tagList
        return returnValue
    }

    reordered(orderGroups: string[]): TagTree<NodeData, Extra> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { reorder: orderGroups }]
        return returnValue
    }

    _tagMatchOperationIndices(tags: TagListItem<NodeData, Extra>[], operation: TagTreeMatchOperation<NodeData, Extra>, recurse?: (operation: TagTreeMatchOperation<NodeData, Extra>) => number[]): number[] {
        const indicesMatching = (operand: TagTreeMatchOperand<NodeData, Extra>): number[] => {
            return tags.map((node, index) => {
                if (typeof operand === 'string' && this._classifier(node.data) === operand) {
                    return [index]
                }
                else if (typeof operand === 'function' && (operand as (value: { data: NodeData } & Extra) => boolean)(node)) {
                    return [index]
                }
                else if (typeof operand === 'object' && this._compare(operand, node)) {
                    return [index]
                }
                else {
                    return []
                }
            }).flat(1)
        }
        if ('match' in operation) {
            return indicesMatching(operation.match)
        }
        if ('sequence' in operation) {
            const matchLists = operation.sequence.map(recurse ?? ((operation) => (this._tagMatchOperationIndices(tags, operation))))
            return matchLists.reduce<number[]>((previous, matches) => {
                if (!previous.length) {
                    return []
                }
                if (previous[0] === -1) {
                    return matches
                }
                const leftMost = previous[0]
                return matches.filter((index) => (index > leftMost))
            }, [-1])
        }
        if ('after' in operation) {
            const matches = recurse ? recurse(operation.after) : this._tagMatchOperationIndices(tags, operation.after)
            if (matches.length) {
                return tags.map((_, index) => (index)).filter((index) => (index > matches[0]))
            }
        }
        if ('before' in operation) {
            const matches = recurse ? recurse(operation.before) : this._tagMatchOperationIndices(tags, operation.before)
            if (matches.length) {
                const rightMostMatch = matches.slice(-1)[0]
                return tags.map((_, index) => (index)).filter((index) => (index < rightMostMatch))
            }
        }
        return []
    }
    //
    // Create a new (likely smaller) tag tree with only the leaf nodes that meet the filtering criteria.
    //
    filter(args: TagTreeFilterArguments<NodeData, Extra>): TagTree<NodeData, Extra> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { filter: args }]
        return returnValue
    }

    //
    // Create a tag tree with less levels by pruning specified tags out of the lists
    //
    prune(args: TagTreePruneArgs<NodeData, Extra>): TagTree<NodeData, Extra> {
        const returnValue = new TagTree<NodeData, Extra>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })

        //
        // Recursive match between tagList and a (possibly recursive) MatchOperator
        //
        const pruneMatch = (arg: TagTreePruneArgs<NodeData, Extra>, tagList: TagListItem<NodeData, Extra>[]): number[] => {
            const allIndices = tagList.map((_, index) => (index))
            if ('not' in arg) {
                const recurse = pruneMatch(arg.not, tagList)
                return allIndices.filter((index) => (!recurse.includes(index)))
            }
            if ('and' in arg) {
                return arg.and.reduce<number[]>((previous, subArg) => {
                    const recurse = pruneMatch(subArg, tagList)
                    return previous.filter((index) => (recurse.includes(index)))
                }, allIndices).sort()
            }
            if ('or' in arg) {
                return unique(arg.or
                    .map<number[]>((subArg) => (pruneMatch(subArg, tagList)))
                    .flat(1)).sort()
            }
            return this._tagMatchOperationIndices(tagList, arg, (operation) => (pruneMatch(operation, tagList)))
        }
        returnValue._tagList = this._transformedTags
            .map((tags) => {
                const indicesToPrune = pruneMatch(args, tags)
                return tags.map((node, index) => (indicesToPrune.includes(index) ? [] : [node])).flat(1)
            })
        return returnValue
    }

}

export default TagTree

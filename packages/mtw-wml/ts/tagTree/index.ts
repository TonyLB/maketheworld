import { deepEqual } from "../lib/objects";
import { unique } from "../list";
import { GenericTree } from "../sequence/tree/baseClasses"
import dfsWalk from "../sequence/tree/dfsWalk"

type TagTreeTreeOptions<NodeData extends {}> = {
    classify: (data: NodeData) => string;
    compare?: (A: NodeData, B: NodeData) => boolean;
    orderIndependence?: string[][];
}

type TagTreeMatchOperand<NodeData extends {}> = 
    string |
    NodeData |
    { (value: NodeData): boolean }

type TagTreeMatchAfter<NodeData extends {}> = {
    after: TagTreeMatchOperand<NodeData>
}

type TagTreeMatchBefore<NodeData extends {}> = {
    before: TagTreeMatchOperand<NodeData>
}

type TagTreeMatchExact<NodeData extends {}> = {
    match: TagTreeMatchOperand<NodeData>
}

type TagTreeMatchNot<NodeData extends {}> = {
    not: TagTreeMatchOperation<NodeData>
}

type TagTreeMatchAnd<NodeData extends {}> = {
    and: TagTreeMatchOperation<NodeData>[]
}

type TagTreeMatchOr<NodeData extends {}> = {
    or: TagTreeMatchOperation<NodeData>[]
}

type TagTreeMatchOperation<NodeData extends {}> = TagTreeMatchAfter<NodeData> | TagTreeMatchBefore<NodeData> | TagTreeMatchExact<NodeData> | TagTreeMatchNot<NodeData> | TagTreeMatchAnd<NodeData> | TagTreeMatchOr<NodeData>

type TagTreeFilterArguments<NodeData extends {}> = (TagTreeMatchExact<NodeData> | TagTreeMatchNot<NodeData> | TagTreeMatchAnd<NodeData> | TagTreeMatchOr<NodeData>)
const isTagTreeFilterArgument = <NodeData extends {}>(arg: TagTreeMatchOperation<NodeData>): arg is TagTreeFilterArguments<NodeData> => {
    return ('not' in arg || 'and' in arg || 'or' in arg || 'match' in arg)
}

type TagTreePruneArgs<NodeData extends {}> = TagTreeMatchOperation<NodeData>

export const tagListFromTree = <NodeData extends {}>(tree: GenericTree<NodeData>): NodeData[][] => {
    return dfsWalk<NodeData, NodeData[][], {}>({
        default: { output: [], state: {} },
        callback: (previous: { output: NodeData[][], state: {} }, data: NodeData) => {
            return { output: [...previous.output, [data]], state: {} }
        },
        aggregate: ({ direct, children, data }) => {
            return {
                output: [
                    ...(children.output.length ? direct.output.slice(0, -1) : direct.output),
                    ...children.output.map((nodes) => ([...(data ? [data] : []), ...nodes]))
                ],
                state: {}
            }
        }
    })(tree)
}

export const iterativeMerge = <NodeData extends {}>(options: TagTreeTreeOptions<NodeData>) => (previous: GenericTree<NodeData>, tagItem: NodeData[]): GenericTree<NodeData> => {
    if (!tagItem.length) {
        return previous
    }
    const compare = options.compare ?? deepEqual
    if (previous.length) {
        const classOne = options.classify(tagItem[0])
        const { matchIndex } = previous.reduceRight<{ matchIndex?: number; noMatch?: boolean }>((matchReduce, { data }, index) => {
            //
            // If a result has already been found then continue to the exit of the loop
            //
            if ((typeof matchReduce.matchIndex !== 'undefined') || matchReduce.noMatch) {
                return matchReduce
            }
            //
            // If this current data point *is* the match, return that index
            //
            if (compare(data, tagItem[0])) {
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
            return [
                ...previous.slice(0, matchIndex),
                { data: previous[matchIndex].data, children: iterativeMerge(options)(previous[matchIndex].children, tagItem.slice(1)) },
                ...previous.slice(matchIndex + 1)
            ]
        }
    }
    return [...previous, { data: tagItem[0], children: iterativeMerge(options)([], tagItem.slice(1)) }]
}


export class TagTree<NodeData extends {}> {
    _tagList: NodeData[][];
    _compare: (A: NodeData, B: NodeData) => boolean;
    _classifier: (data: NodeData) => string;
    _orderIndependence: string[][];

    constructor(args: { tree: GenericTree<NodeData> } & TagTreeTreeOptions<NodeData>) {
        this._classifier = args.classify
        this._orderIndependence = args.orderIndependence ?? []
        this._compare = args.compare ?? deepEqual
        this._tagList = tagListFromTree(args.tree)
    }

    get tree() {
        return this._tagList.reduce<GenericTree<NodeData>>(iterativeMerge({ classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence }), [])
    }


    //
    // Reorder a list of tags so that any tags classified to classes that are specified in the order argument
    // are arranged in the same order *as* that argument, with minimal changes otherwise (basically, bubble-sort
    // the specified classes and only those, in place)
    //
    _reorderTags(order: string[]) {
        return (tags: NodeData[]): NodeData[] => {
            const returnValue = tags.reduce<NodeData[]>((previous, node) => {
                const orderIndex = order.indexOf(this._classifier(node))
                const sortBeforeList = orderIndex === -1 ? [] : order.slice(orderIndex + 1)
                if (sortBeforeList.length) {
                    const sortBeforeIndex = previous.findIndex((node) => (sortBeforeList.includes(this._classifier(node))))
                    if (sortBeforeIndex !== -1) {
                        return [
                            ...previous.slice(0, sortBeforeIndex),
                            node,
                            ...previous.slice(sortBeforeIndex)
                        ]
                    }
                }
                return [...previous, node]
            }, [])
            return returnValue
        }
    }
    //
    // Create a new TagTree with tags ordered (and therefore grouped) in a new way. The orderGroups will specify
    // how to internally reorder tags.
    //
    reordered(orderGroups: string[]): TagTree<NodeData> {
        const returnValue = new TagTree<NodeData>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })
        returnValue._tagList = this._tagList.map(this._reorderTags(orderGroups))
        return returnValue
    }

    _tagMatchOperationIndices(tags: NodeData[], operation: TagTreeMatchOperation<NodeData>): number[] {
        const indicesMatching = (operand: TagTreeMatchOperand<NodeData>): number[] => {
            return tags.map((node, index) => {
                if (typeof operand === 'string' && this._classifier(node) === operand) {
                    return [index]
                }
                else if (typeof operand === 'function' && (operand as (value: NodeData) => boolean)(node)) {
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
        if ('after' in operation) {
            const matches = indicesMatching(operation.after)
            if (matches.length) {
                return tags.map((_, index) => (index)).filter((index) => (index > matches[0]))
            }
        }
        if ('before' in operation) {
            const matches = indicesMatching(operation.before)
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
    filter(args: TagTreeFilterArguments<NodeData>): TagTree<NodeData> {
        const returnValue = new TagTree<NodeData>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })
        //
        // Recursive match between tagList and a (possibly recursive) MatchOperator
        //
        const filterMatch = (arg: TagTreeFilterArguments<NodeData>, tagList: NodeData[]): Boolean => {
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
        returnValue._tagList = this._tagList
            .filter((tags) => (filterMatch(args, tags)))
        return returnValue
    }

    //
    // Create a tag tree with less levels by pruning specified tags out of the lists
    //
    prune(args: TagTreePruneArgs<NodeData>): TagTree<NodeData> {
        const returnValue = new TagTree<NodeData>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })

        //
        // Recursive match between tagList and a (possibly recursive) MatchOperator
        //
        const pruneMatch = (arg: TagTreePruneArgs<NodeData>, tagList: NodeData[]): number[] => {
            const allIndices = tagList.map((_, index) => (index))
            if ('not' in arg) {
                const recurse = pruneMatch(arg.not, tagList)
                return allIndices.filter((index) => (!recurse.includes(index)))
            }
            if ('and' in arg) {
                return arg.and.reduce<number[]>((previous, subArg) => {
                    const recurse = pruneMatch(subArg, tagList)
                    return previous.filter((index) => (recurse.includes(index)))
                }, allIndices)
            }
            if ('or' in arg) {
                return unique(arg.or
                    .map<number[]>((subArg) => (pruneMatch(subArg, tagList)))
                    .flat(1))
            }
            return this._tagMatchOperationIndices(tagList, arg)
        }
        returnValue._tagList = this._tagList
            .map((tags) => {
                const indicesToPrune = pruneMatch(args, tags)
                return tags.map((node, index) => (indicesToPrune.includes(index) ? [] : [node])).flat(1)
            })
        return returnValue
    }

}

export default TagTree

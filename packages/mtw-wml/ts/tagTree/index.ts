import { v4 as uuidv4 } from 'uuid'
import { deepEqual } from "../lib/objects"
import { unique } from "../list"
import { GenericTree } from "../tree/baseClasses"
import dfsWalk from "../tree/dfsWalk"

type TagTreeTreeOptions<NodeData extends {}, Extra extends {} = {}> = {
    classify: (data: NodeData) => string;
    isWrapper?: (data: NodeData) => boolean;
    compare?: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => boolean;
    merge?: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => ({ data: NodeData } & Extra);
    orderIndependence?: string[][];
    orderSort?: string[][];
}

type TagTreeMatchOperand<NodeData extends {}, Extra extends {} = {}> = 
    string |
    ({ data: NodeData } & Extra) |
    { (value: { data: NodeData } & Extra): boolean }

type TagTreeMatchSequence<NodeData extends {}, Extra extends {} = {}> = {
    sequence: TagTreeMatchOperation<NodeData, Extra>[]
}

type TagTreeMatchConnected<NodeData extends {}, Extra extends {} = {}> = {
    connected: TagTreeMatchOperation<NodeData, Extra>[]
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
    TagTreeMatchConnected<NodeData, Extra> |
    TagTreeMatchAfter<NodeData, Extra> |
    TagTreeMatchBefore<NodeData, Extra> |
    TagTreeMatchExact<NodeData, Extra> |
    TagTreeMatchNot<NodeData, Extra> |
    TagTreeMatchAnd<NodeData, Extra> |
    TagTreeMatchOr<NodeData, Extra>

export type TagListItem<NodeData extends {}, Extra extends {} = {}> = {
    data: NodeData;
    wrapperTag?: string;
} & Extra

type TagTreeActionReorder<NodeData extends {}, Extra extends {} = {}> = { reorder: TagTreePruneArgs<NodeData, Extra>[] }
type TagTreeActionFilter<NodeData extends {}, Extra extends {} = {}> = { filter: TagTreeFilterArguments<NodeData, Extra> }
type TagTreeActionPrune<NodeData extends {}, Extra extends {} = {}> = { prune: TagTreePruneArgs<NodeData, Extra> }

export type TagTreeAction<NodeData extends {}, Extra extends {} = {}> =
    TagTreeActionReorder<NodeData, Extra> |
    TagTreeActionFilter<NodeData, Extra> |
    TagTreeActionPrune<NodeData, Extra>

const isTagTreeActionReorder = <NodeData extends {}, Extra extends {} = {}>(action: TagTreeAction<NodeData, Extra>): action is TagTreeActionReorder<NodeData, Extra> => ('reorder' in action)
const isTagTreeActionFilter = <NodeData extends {}, Extra extends {} = {}>(action: TagTreeAction<NodeData, Extra>): action is TagTreeActionFilter<NodeData, Extra> => ('filter' in action)
const isTagTreeActionPrune = <NodeData extends {}, Extra extends {} = {}>(action: TagTreeAction<NodeData, Extra>): action is TagTreeActionPrune<NodeData, Extra> => ('prune' in action)

type TagTreeFilterArguments<NodeData extends {}, Extra extends {} = {}> = (TagTreeMatchExact<NodeData, Extra> | TagTreeMatchNot<NodeData, Extra> | TagTreeMatchAnd<NodeData, Extra> | TagTreeMatchOr<NodeData, Extra>)
const isTagTreeFilterArgument = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperation<NodeData, Extra>): arg is TagTreeFilterArguments<NodeData, Extra> => {
    return ('not' in arg || 'and' in arg || 'or' in arg || 'match' in arg)
}
// const isTagTreeNodeDataOperandNested = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperand<NodeData, Extra>): arg is { data: NodeData } & Extra => (typeof arg === 'object' && 'data' in arg)
// const isTagTreeNodeDataOperandUnnested = <NodeData extends {}, Extra extends {} = {}>(arg: TagTreeMatchOperand<NodeData, Extra>): arg is NodeData => (typeof arg === 'object' && !('data' in arg))

type TagTreePruneArgs<NodeData extends {}, Extra extends {} = {}> = TagTreeMatchOperation<NodeData, Extra>

export const tagListFromTree = <NodeData extends {}, Extra extends {} = {}>(tree: GenericTree<NodeData, Extra>, options: { isWrapper?: (data: NodeData) => boolean } = {}): TagListItem<NodeData, Extra>[][] => {
    return dfsWalk({
        default: { output: [], state: {} },
        callback: (previous: { output: TagListItem<NodeData, Extra>[][], state: {} }, data: NodeData, extra: Extra) => {
            return { output: [...previous.output, [{ data, ...extra }]], state: {} }
        },
        aggregate: ({ direct, children, data, extra }) => {
            const wrapperTag: string | undefined = (data && options.isWrapper?.(data as NodeData)) ? uuidv4() : undefined
            return {
                output: [
                    ...(children.output.length ? direct.output.slice(0, -1) : direct.output),
                    ...children.output.map((nodes) => ([...(data ? [{ data, ...(extra as unknown as Extra), wrapperTag }] : []), ...nodes]))
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
        //
        // TODO: Create mergePast list from orderIndependence
        //
        const sortPosition = (options.orderSort ?? []).findIndex((classificationList) => (classificationList.includes(classOne)))
        const sortPast = sortPosition === -1 ? [] : (options.orderSort ?? []).slice(sortPosition + 1).flat(1)
        const mergePast = [
            ...((options.orderIndependence ?? []).filter((classificationList) => (classificationList.includes(classOne))).flat(1)),
            ...sortPast
        ]

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
            if (mergePast.includes(classTwo)) {
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
        //
        // If no merge, check whether there are elements at the end of the list that the
        // newly added element should be sorted before
        //
        const positionToInsert = previous.reduceRight((previous, { data }, index) => {
            const classTwo = options.classify(data)
            if (sortPast.includes(classTwo)) {
                return index
            }
            return previous
        }, -1)
        if (positionToInsert !== -1) {
            return [
                ...previous.slice(0, positionToInsert),
                { ...tagItem[0], children: iterativeMerge(options)([], tagItem.slice(1)) },
                ...previous.slice(positionToInsert)

            ]
        }
    }
    return [...previous, { ...tagItem[0], children: iterativeMerge(options)([], tagItem.slice(1)) }]
}

type FilterTagPendingWrapperEntry<NodeData extends {}, Extra extends {} = {}> = {
    // UUID identifying the wrapperTag
    wrapperTag: string;
    // TagTree up to the point of the wrapperTag (inclusive)
    treeToWrapper: TagListItem<NodeData, Extra>[];
    // List of direct child tags of the wrapperTag that have not (yet) been included in
    // the tagTree
    pending: TagListItem<NodeData, Extra>[];
    // False if *any* child of the pending Wrapper has passed filter (and therefore all
    // pending entries must be persisted eventually)
    uncertain: boolean;
}
type FilterTagsState<NodeData extends {}, Extra extends {} = {}> = {
    filteredTags: TagListItem<NodeData, Extra>[][];
    pendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData, Extra>[];
}

//
// filterTagsWithWrapperHandling steps through the tags and records information about
// children of wrapper tags that have (so far) not appeared in the filtered output ... then,
// if one of their siblings passes the filter, adds those tags to maintain structure.
//
const filterTagsWithWrapperHandling = <NodeData extends {}, Extra extends {} = {}>(options: { filter: (tagList: TagListItem<NodeData, Extra>[]) => Boolean; compare: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => boolean; }) => (tagLists: TagListItem<NodeData, Extra>[][]): TagListItem<NodeData, Extra>[][] => {
    const { compare } = options
    //
    // neededWrapperTagList is a helper function to take pending wrapper entries, and generate the
    // TagLists that need to be added to filter output in order to maintain the internal structure
    // for relevant wrapper items.
    //
    const neededWrapperTagLists = (args: {
            incomingTagList: TagListItem<NodeData, Extra>[];
            pendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData, Extra>[];
            filterPass: Boolean;
        }): {
            neededTagLists: TagListItem<NodeData, Extra>[][];
            newPendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData, Extra>[];
        } => {
        const { incomingTagList, pendingWrapperEntries, filterPass } = args
        //
        // Make a list of all wrapper entries in the current tagList
        //
        const currentWrapperEntries: FilterTagPendingWrapperEntry<NodeData, Extra>[] = incomingTagList.map((item, index) => (
            (item.wrapperTag && index < incomingTagList.length - 1)
                ? [{
                    wrapperTag: item.wrapperTag,
                    treeToWrapper: incomingTagList.slice(0, index + 1),
                    pending: [incomingTagList[index + 1]],
                    uncertain: !filterPass
                }]
                : []
        )).flat(1)
        const neededTagLists = pendingWrapperEntries.reduce<TagListItem<NodeData, Extra>[][]>((previous, pendingEntry) => {
            const matchingCurrentWrapperEntry = currentWrapperEntries.find(({ wrapperTag }) => (wrapperTag === pendingEntry.wrapperTag))
            if (!matchingCurrentWrapperEntry) {
                if (pendingEntry.uncertain) {
                    return previous
                }
                else {
                    return [...previous, ...pendingEntry.pending.map((node) => ([...pendingEntry.treeToWrapper, node]))]
                }
            }
            else {
                if (matchingCurrentWrapperEntry.uncertain && pendingEntry.uncertain) {
                    return previous
                } else {
                    return [
                        ...previous,
                        ...pendingEntry.pending
                            .filter((node) => (!compare(node, matchingCurrentWrapperEntry.pending[0])))
                            .map((node) => ([...pendingEntry.treeToWrapper, node]))
                    ]
                }
            }
        }, [])
        const newPendingWrapperEntries = [
            ...pendingWrapperEntries.reduce<FilterTagPendingWrapperEntry<NodeData, Extra>[]>((previous, pendingEntry) => {
                const matchingCurrentWrapperEntry = currentWrapperEntries.find(({ wrapperTag }) => (wrapperTag === pendingEntry.wrapperTag))
                if (!matchingCurrentWrapperEntry) {
                    return previous
                }
                else {
                    if (matchingCurrentWrapperEntry.uncertain && pendingEntry.uncertain) {
                        return [
                            ...previous,
                            {
                                ...pendingEntry,
                                pending: [...pendingEntry.pending.filter((node) => (!compare(node, matchingCurrentWrapperEntry.pending[0]))), ...matchingCurrentWrapperEntry.pending],
                                uncertain: pendingEntry.uncertain && !filterPass
                            }
                        ]
                    }
                    else if (matchingCurrentWrapperEntry.uncertain) {
                        return [
                            ...previous,
                            {
                                ...pendingEntry,
                                pending: matchingCurrentWrapperEntry.pending,
                                uncertain: pendingEntry.uncertain && !filterPass
                            }
                        ]
                    }
                    else {
                        return [
                            ...previous,
                            {
                                ...pendingEntry,
                                pending: [],
                                uncertain: pendingEntry.uncertain && !filterPass
                            }
                        ]
                    }
                }
            }, []),
            ...currentWrapperEntries.filter(({ wrapperTag }) => (!pendingWrapperEntries.find(({ wrapperTag: pendingWrapperTag }) => (wrapperTag === pendingWrapperTag))))
        ].sort(({ treeToWrapper: baseListA }, { treeToWrapper: baseListB }) => (baseListB.length - baseListA.length))
        return { neededTagLists, newPendingWrapperEntries }
    }
    const { filteredTags, pendingWrapperEntries } = tagLists.reduce<FilterTagsState<NodeData, Extra>>((accumulator, tagList) => {
        const filterPass = options.filter(tagList)
        const {neededTagLists, newPendingWrapperEntries } = neededWrapperTagLists({ incomingTagList: tagList, pendingWrapperEntries: accumulator.pendingWrapperEntries, filterPass })
        return {
            filteredTags: [
                ...accumulator.filteredTags,
                ...neededTagLists,
                ...(filterPass ? [tagList] : [])
            ],
            pendingWrapperEntries: newPendingWrapperEntries
        }
    }, { filteredTags: [], pendingWrapperEntries: [] })
    const { neededTagLists } = neededWrapperTagLists({ incomingTagList: [], pendingWrapperEntries, filterPass: false })
    return [...filteredTags, ...neededTagLists]
}

export class TagTree<NodeData extends {}, Extra extends {} = {}> {
    _tagList: TagListItem<NodeData, Extra>[][];
    _compare: (A: { data: NodeData } & Extra, B: { data: NodeData } & Extra) => boolean;
    _isWrapper?: (data: NodeData) => boolean;
    _classifier: (data: NodeData) => string;
    _orderIndependence: string[][];
    _orderSort: string[][] = [];
    _merge?: (A: TagListItem<NodeData, Extra>, B: TagListItem<NodeData, Extra>) => TagListItem<NodeData, Extra>
    _actions: TagTreeAction<NodeData, Extra>[] = [];

    constructor(args: { tree: GenericTree<NodeData, Extra> } & TagTreeTreeOptions<NodeData, Extra>) {
        this._classifier = args.classify
        this._orderIndependence = args.orderIndependence ?? []
        this._compare = args.compare ?? deepEqual
        this._isWrapper = args.isWrapper
        this._merge = args.merge
        this._tagList = tagListFromTree(args.tree, { isWrapper: this._isWrapper })
    }

    get tree() {
        return this._transformedTags.reduce<GenericTree<NodeData, Extra>>(iterativeMerge<NodeData, Extra>({ classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence, orderSort: this._orderSort, merge: this._merge }), [])
    }

    //
    // Identify the indices of tags in a list that match pruning arguments
    //
    _tagMatch(arg: TagTreePruneArgs<NodeData, Extra>, tagList: TagListItem<NodeData, Extra>[]): number[] {
        const allIndices = tagList.map((_, index) => (index))
        if ('not' in arg) {
            const recurse = this._tagMatch(arg.not, tagList)
            return allIndices.filter((index) => (!recurse.includes(index)))
        }
        if ('and' in arg) {
            return arg.and.reduce<number[]>((previous, subArg) => {
                const recurse = this._tagMatch(subArg, tagList)
                return previous.filter((index) => (recurse.includes(index)))
            }, allIndices).sort()
        }
        if ('or' in arg) {
            return unique(arg.or
                .map<number[]>((subArg) => (this._tagMatch(subArg, tagList)))
                .flat(1)).sort()
        }
        return this._tagMatchOperationIndices(tagList, arg, (operation) => (this._tagMatch(operation, tagList)))
    }

    //
    // Create a new TagTree with tags ordered (and therefore grouped) in a new way. The orderGroups will specify
    // how to internally reorder tags.
    //
    _reorderTags(order: TagTreePruneArgs<NodeData, Extra>[]) {
        return (tags: TagListItem<NodeData, Extra>[]): TagListItem<NodeData, Extra>[] => {
            //
            // Percolate groups of tags to the top of the list, in right-to-left order, so that the highest
            // priority are moved to the top LAST (and therefore end up at the top, as they should)
            //

            //
            // Precalculate the maximum and minimum index of items being reordered, and leave everything
            // outside of that range alone.
            //
            
            const { minIndex, maxIndex } = order.reduce<{ minIndex: number; maxIndex: number }>(({ minIndex, maxIndex }, reorderArg) => {
                const matchingIndices = this._tagMatch(reorderArg, tags)
                if (matchingIndices.length) {
                    return {
                        minIndex: Math.min(minIndex, matchingIndices[0]),
                        maxIndex: Math.max(maxIndex, matchingIndices.slice(-1)[0] + 1)
                    }
                }
                else {
                    return { minIndex, maxIndex }
                }
            }, { minIndex: Infinity, maxIndex: 0 })
            if (minIndex > maxIndex) {
                return tags
            }
            const untouchedPriorTags = tags.slice(0, minIndex)
            const tagsToConsider = tags.slice(minIndex, maxIndex)
            const untouchedAfterTags = tags.slice(maxIndex)
            const returnValue = order.reduceRight<TagListItem<NodeData, Extra>[]>((previous, reorderArg) => {
                const matchingIndices = this._tagMatch(reorderArg, previous)
                const { percolatedTags, remainingTags } = previous.reduce<{ percolatedTags: TagListItem<NodeData, Extra>[], remainingTags: TagListItem<NodeData, Extra>[] }>(({ percolatedTags, remainingTags }, tag, index) => {
                    if (matchingIndices.includes(index)) {
                        return { percolatedTags: [...percolatedTags, tag ], remainingTags }
                    }
                    else {
                        return { percolatedTags, remainingTags: [...remainingTags, tag] }
                    }
                }, { percolatedTags: [], remainingTags: [] })
                return [...percolatedTags, ...remainingTags]
            }, tagsToConsider)
            return [...untouchedPriorTags, ...returnValue, ...untouchedAfterTags]
        }
    }

    //
    // Create a new (likely smaller) tag tree with only the leaf nodes that meet the filtering criteria.
    //
    _filterTags(args: TagTreeFilterArguments<NodeData, Extra>) {
        return (tags: TagListItem<NodeData, Extra>[]): Boolean => {
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
                const reorderedTags = previous.map((tagList) => (this._reorderTags(action.reorder)(tagList)))
                return reorderedTags
            }
            if (isTagTreeActionFilter(action)) {
                const filteredTags = filterTagsWithWrapperHandling({ filter: this._filterTags(action.filter), compare: this._compare.bind(this) })(previous)
                return filteredTags
            }
            if (isTagTreeActionPrune(action)) {
                const prunedTags = previous.map((tagList) => {
                    const pruneIndices = this._tagMatch(action.prune, tagList)
                    return tagList.map((_, index) => (index)).filter((index) => (!pruneIndices.includes(index))).map((index) => (tagList[index]))
                })
                return prunedTags
            }
            return previous
        }, this._tagList)
    }

    clone(): TagTree<NodeData, Extra> {
        const returnValue = new TagTree<NodeData, Extra>({ tree: [], classify: this._classifier, compare: this._compare, merge: this._merge, orderIndependence: this._orderIndependence })
        returnValue._tagList = this._tagList
        return returnValue
    }

    reordered(orderGroups: TagTreePruneArgs<NodeData, Extra>[]): TagTree<NodeData, Extra> {
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
        if ('connected' in operation) {
            const possibleFirstMatches = recurse ? recurse(operation.connected[0]) : this._tagMatchOperationIndices(tags, operation.connected[0])
            const validFirstMatches = operation.connected.slice(1).reduce<number[]>((previous, subOp, index) => {
                const nextMatches = recurse ? recurse(subOp) : this._tagMatchOperationIndices(tags, subOp)
                return previous.filter((possibleIndex) => (nextMatches.includes(possibleIndex + index + 1)))
            }, possibleFirstMatches)
            const offsets = operation.connected.map((_, index) => (index))
            return unique(...validFirstMatches.map((firstIndex) => (offsets.map((offset) => (firstIndex + offset))))).sort()
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
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { prune: args }]
        return returnValue
    }

    reorderedSiblings(orderSort: string[][]): TagTree<NodeData, Extra> {
        const returnValue = this.clone()
        returnValue._orderSort = orderSort
        return returnValue
    }

}

export default TagTree

import { v4 as uuidv4 } from 'uuid'
import { deepEqual } from "../lib/objects"
import { unique } from "../list"
import { GenericTree, GenericTreeExtended, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import dfsWalk from "../tree/dfsWalk"

type TagTreeTreeOptions<NodeData extends {}> = {
    classify: (data: NodeData) => string;
    isWrapper?: (data: NodeData) => boolean;
    compare?: (A: { data: NodeData }, B: { data: NodeData }) => boolean;
    merge?: (A: { data: NodeData }, B: { data: NodeData }) => ({ data: NodeData });
    orderIndependence?: string[][];
    orderIndependenceIgnore?: string[];
    orderSort?: string[][];
}

type TagTreeMatchOperand<NodeData extends {}> = 
    string |
    ({ data: NodeData }) |
    { (value: { data: NodeData }, stack: NodeData[]): boolean }

type TagTreeMatchSequence<NodeData extends {}> = {
    sequence: TagTreeMatchOperation<NodeData>[]
}

type TagTreeMatchConnected<NodeData extends {}> = {
    connected: TagTreeMatchOperation<NodeData>[]
}

type TagTreeMatchAfter<NodeData extends {}> = {
    after: TagTreeMatchOperation<NodeData>
}

type TagTreeMatchBefore<NodeData extends {}> = {
    before: TagTreeMatchOperation<NodeData>
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

export type TagTreeMatchOperation<NodeData extends {}> =
    TagTreeMatchSequence<NodeData> |
    TagTreeMatchConnected<NodeData> |
    TagTreeMatchAfter<NodeData> |
    TagTreeMatchBefore<NodeData> |
    TagTreeMatchExact<NodeData> |
    TagTreeMatchNot<NodeData> |
    TagTreeMatchAnd<NodeData> |
    TagTreeMatchOr<NodeData>

export type TagListItem<NodeData extends {}> = {
    data: NodeData;
    wrapperTag?: string;
}

type TagTreeActionReorder<NodeData extends {}> = { reorder: TagTreePruneArgs<NodeData>[] }
type TagTreeActionReorderFunctional<NodeData extends {}> = { matches: TagTreeMatchOperation<NodeData>[], reorder: (tags: TagListItem<NodeData>[]) => TagListItem<NodeData>[] }
type TagTreeActionReorderSiblings = { reorderSiblings: string[][] }
type TagTreeActionFilter<NodeData extends {}> = { filter: TagTreeFilterArguments<NodeData> }
type TagTreeActionPrune<NodeData extends {}> = { prune: TagTreePruneArgs<NodeData> }

export type TagTreeAction<NodeData extends {}> =
    TagTreeActionReorder<NodeData> |
    TagTreeActionReorderFunctional<NodeData> |
    TagTreeActionReorderSiblings |
    TagTreeActionFilter<NodeData> |
    TagTreeActionPrune<NodeData>

const isTagTreeActionReorder = <NodeData extends {}>(action: TagTreeAction<NodeData>): action is TagTreeActionReorder<NodeData> => ('reorder' in action && Array.isArray(action.reorder))
const isTagTreeActionReorderFunctional = <NodeData extends {}>(action: TagTreeAction<NodeData>): action is TagTreeActionReorderFunctional<NodeData> => ('reorder' in action && typeof action.reorder === 'function')
const isTagTreeActionReorderSiblings = <NodeData extends {}>(action: TagTreeAction<NodeData>): action is TagTreeActionReorderSiblings => ('reorderSiblings' in action)
const isTagTreeActionFilter = <NodeData extends {}>(action: TagTreeAction<NodeData>): action is TagTreeActionFilter<NodeData> => ('filter' in action)
const isTagTreeActionPrune = <NodeData extends {}>(action: TagTreeAction<NodeData>): action is TagTreeActionPrune<NodeData> => ('prune' in action)

export type TagTreeFilterArguments<NodeData extends {}> = (TagTreeMatchExact<NodeData> | TagTreeMatchNot<NodeData> | TagTreeMatchAnd<NodeData> | TagTreeMatchOr<NodeData> | TagTreeMatchSequence<NodeData>)
const isTagTreeFilterArgument = <NodeData extends {}>(arg: TagTreeMatchOperation<NodeData>): arg is TagTreeFilterArguments<NodeData> => {
    return ('not' in arg || 'and' in arg || 'or' in arg || 'match' in arg || 'sequence' in arg)
}
// const isTagTreeNodeDataOperandNested = <NodeData extends {}>(arg: TagTreeMatchOperand<NodeData>): arg is { data: NodeData } & Extra => (typeof arg === 'object' && 'data' in arg)
// const isTagTreeNodeDataOperandUnnested = <NodeData extends {}>(arg: TagTreeMatchOperand<NodeData>): arg is NodeData => (typeof arg === 'object' && !('data' in arg))

export type TagTreePruneArgs<NodeData extends {}> = TagTreeMatchOperation<NodeData>

export const tagListFromTree = <NodeData extends {}>(tree: GenericTree<NodeData>, options: { isWrapper?: (data: NodeData) => boolean } = {}): TagListItem<NodeData>[][] => {
    return dfsWalk({
        default: { output: [], state: {} },
        callback: (previous: { output: TagListItem<NodeData>[][], state: {} }, data: NodeData) => {
            return { output: [...previous.output, [{ data }]], state: {} }
        },
        aggregate: ({ direct, children, data }) => {
            const wrapperTag: string | undefined = (data && options.isWrapper?.(data as NodeData)) ? uuidv4() : undefined
            return {
                output: [
                    ...(children.output.length ? direct.output.slice(0, -1) : direct.output),
                    ...children.output.map((nodes) => ([...(data ? [{ data, wrapperTag }] : []), ...nodes]))
                ],
                state: {}
            }
        }
    })(tree)
}

export const iterativeMerge = <NodeData extends {}>(options: TagTreeTreeOptions<NodeData>) => (previous: GenericTreeExtended<NodeData, { wrapperTag?: string }>, tagItem: TagListItem<NodeData>[]): GenericTree<NodeData> => {
    const orderIndependenceTagFromTagItem = (checkItem: TagListItem<NodeData>[]): string | undefined => (
        checkItem.map(({ data }) => (options.classify(data))).find((classification) => (!options.orderIndependenceIgnore?.includes(classification)))
    )
    const orderIndependenceTagFromTreeNode = (checkNode: GenericTreeNode<NodeData>): string | undefined => {
        const { data, children } = checkNode
        if (options.orderIndependenceIgnore?.includes(options.classify(data))) {
            return children.reduce<string | undefined>((previous, node) => {
                if (previous) {
                    return previous
                }
                return orderIndependenceTagFromTreeNode(node)
            }, undefined)
        }
        return options.classify(data)
    }
    if (!tagItem.length) {
        return previous
    }
    const compare = options.compare ?? deepEqual
    const merge: (A: TagListItem<NodeData>, B: TagListItem<NodeData>) => TagListItem<NodeData> = options.merge ?? ((A, B) => ({ ...A, data: { ...A.data, ...B.data } }))
    if (previous.length) {
        //
        // Find the class of the tagItem that is not ignored for orderIndependence
        //
        const classOne = orderIndependenceTagFromTagItem(tagItem)
        if (classOne) {
            //
            // Create mergePast list from orderIndependence
            //
            const sortPosition = (options.orderSort ?? []).findIndex((classificationList) => (classificationList.includes(classOne)))
            const sortPast = sortPosition === -1 ? [] : (options.orderSort ?? []).slice(sortPosition + 1).flat(1)
            const mergePast = [
                ...((options.orderIndependence ?? []).filter((classificationList) => (classificationList.includes(classOne))).flat(1)),
                ...sortPast
            ]

            const { matchIndex } = previous.reduceRight<{ matchIndex?: number; noMatch?: boolean }>((matchReduce, node, index) => {
                const { data, wrapperTag } = node
                //
                // If a result has already been found then continue to the exit of the loop
                //
                if ((typeof matchReduce.matchIndex !== 'undefined') || matchReduce.noMatch) {
                    return matchReduce
                }
                //
                // If this current data point *is* the match, return that index
                //
                if (compare({ data }, { data: tagItem[0].data }) && (!((wrapperTag || tagItem[0].wrapperTag) && (wrapperTag !== tagItem[0].wrapperTag)))) {
                    return { matchIndex: index }
                }
                //
                // Find the class of the item being checked that is not ignored for orderIndependence
                //
                const classTwo = orderIndependenceTagFromTreeNode(node)
                //
                // Otherwise, if this element is one that can be merged past because of
                // order independence then continue the search
                //
                if (classTwo && mergePast.includes(classTwo)) {
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
                const { data, wrapperTag } = previous[matchIndex]
                return [
                    ...previous.slice(0, matchIndex),
                    { ...(merge({ data, wrapperTag } as unknown as TagListItem<NodeData>, tagItem[0])), children: iterativeMerge(options)(previous[matchIndex].children, tagItem.slice(1)) },
                    ...previous.slice(matchIndex + 1)
                ]
            }
            //
            // If no merge, check whether there are elements at the end of the list that the
            // newly added element should be sorted before
            //
            const positionToInsert = previous.reduceRight((previous, node, index) => {
                const classTwo = orderIndependenceTagFromTreeNode(node)
                if (classTwo && sortPast.includes(classTwo)) {
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
    }
    return [...previous, { ...tagItem[0], children: iterativeMerge(options)([], tagItem.slice(1)) }]
}

type FilterTagPendingWrapperEntry<NodeData extends {}> = {
    // UUID identifying the wrapperTag
    wrapperTag: string;
    // TagTree up to the point of the wrapperTag (inclusive)
    treeToWrapper: TagListItem<NodeData>[];
    // List of direct child tags of the wrapperTag that have not (yet) been included in
    // the tagTree
    pending: TagListItem<NodeData>[];
    // False if *any* child of the pending Wrapper has passed filter (and therefore all
    // pending entries must be persisted eventually)
    uncertain: boolean;
}
type FilterTagsState<NodeData extends {}> = {
    filteredTags: TagListItem<NodeData>[][];
    pendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData>[];
}

//
// filterTagsWithWrapperHandling steps through the tags and records information about
// children of wrapper tags that have (so far) not appeared in the filtered output ... then,
// if one of their siblings passes the filter, adds those tags to maintain structure.
//
const filterTagsWithWrapperHandling = <NodeData extends {}>(options: { filter: (tagList: TagListItem<NodeData>[]) => Boolean; compare: (A: { data: NodeData }, B: { data: NodeData }) => boolean; }) => (tagLists: TagListItem<NodeData>[][]): TagListItem<NodeData>[][] => {
    const { compare } = options
    //
    // neededWrapperTagList is a helper function to take pending wrapper entries, and generate the
    // TagLists that need to be added to filter output in order to maintain the internal structure
    // for relevant wrapper items.
    //
    const neededWrapperTagLists = (args: {
            incomingTagList: TagListItem<NodeData>[];
            pendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData>[];
            filterPass: Boolean;
        }): {
            neededTagLists: TagListItem<NodeData>[][];
            newPendingWrapperEntries: FilterTagPendingWrapperEntry<NodeData>[];
        } => {
        const { incomingTagList, pendingWrapperEntries, filterPass } = args
        //
        // Make a list of all wrapper entries in the current tagList
        //
        const currentWrapperEntries: FilterTagPendingWrapperEntry<NodeData>[] = incomingTagList.map((item, index) => (
            (item.wrapperTag && index < incomingTagList.length - 1)
                ? [{
                    wrapperTag: item.wrapperTag,
                    treeToWrapper: incomingTagList.slice(0, index + 1),
                    pending: [incomingTagList[index + 1]],
                    uncertain: !filterPass
                }]
                : []
        )).flat(1)
        const neededTagLists = pendingWrapperEntries.reduce<TagListItem<NodeData>[][]>((previous, pendingEntry) => {
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
            ...pendingWrapperEntries.reduce<FilterTagPendingWrapperEntry<NodeData>[]>((previous, pendingEntry) => {
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
    const { filteredTags, pendingWrapperEntries } = tagLists.reduce<FilterTagsState<NodeData>>((accumulator, tagList) => {
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

export class TagTree<NodeData extends {}> {
    _tagList: TagListItem<NodeData>[][];
    _compare: (A: { data: NodeData }, B: { data: NodeData }) => boolean;
    _isWrapper?: (data: NodeData) => boolean;
    _classifier: (data: NodeData) => string;
    _orderIndependence: string[][];
    _orderIndependenceIgnore: string[];
    _orderSort: string[][] = [];
    _merge?: (A: TagListItem<NodeData>, B: TagListItem<NodeData>) => TagListItem<NodeData>
    _actions: TagTreeAction<NodeData>[] = [];

    constructor(args: { tree: GenericTree<NodeData> } & TagTreeTreeOptions<NodeData>) {
        this._classifier = args.classify
        this._orderIndependence = args.orderIndependence ?? []
        this._orderIndependenceIgnore = args.orderIndependenceIgnore ?? []
        this._compare = args.compare ?? deepEqual
        this._isWrapper = args.isWrapper
        this._merge = args.merge
        this._tagList = tagListFromTree(args.tree, { isWrapper: this._isWrapper })
    }

    get tree() {
        //
        // TODO: Create applyEdits recursive aggregator in schema, and apply it here as an outer wrapper on
        // the tree getter function.
        //
        return this._transformedTags.reduce<GenericTree<NodeData>>(iterativeMerge<NodeData>({
            classify: this._classifier,
            compare: this._compare,
            orderIndependence: this._orderIndependence,
            orderIndependenceIgnore: this._orderIndependenceIgnore,
            orderSort: this._orderSort,
            merge: this._merge
        }), [])
    }

    //
    // Identify the indices of tags in a list that match pruning arguments
    //
    _tagMatch(arg: TagTreePruneArgs<NodeData>, tagList: TagListItem<NodeData>[]): number[] {
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
    _reorderTags(arg: TagTreeActionReorder<NodeData> | TagTreeActionReorderFunctional<NodeData>) {
        return (tags: TagListItem<NodeData>[]): TagListItem<NodeData>[] => {
            //
            // Percolate groups of tags to the top of the list, in right-to-left order, so that the highest
            // priority are moved to the top LAST (and therefore end up at the top, as they should)
            //

            //
            // Precalculate the maximum and minimum index of items being reordered, and leave everything
            // outside of that range alone.
            //
            
            const matches = isTagTreeActionReorder(arg) ? arg.reorder : arg.matches
            const { minIndex, maxIndex } = matches.reduce<{ minIndex: number; maxIndex: number }>(({ minIndex, maxIndex }, reorderArg) => {
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
            let returnValue: TagListItem<NodeData>[] = []
            if (isTagTreeActionReorder(arg)) {
                returnValue = matches.reduceRight<TagListItem<NodeData>[]>((previous, reorderArg) => {
                    const matchingIndices = this._tagMatch(reorderArg, previous)
                    const { percolatedTags, remainingTags } = previous.reduce<{ percolatedTags: TagListItem<NodeData>[], remainingTags: TagListItem<NodeData>[] }>(({ percolatedTags, remainingTags }, tag, index) => {
                        if (matchingIndices.includes(index)) {
                            return { percolatedTags: [...percolatedTags, tag ], remainingTags }
                        }
                        else {
                            return { percolatedTags, remainingTags: [...remainingTags, tag] }
                        }
                    }, { percolatedTags: [], remainingTags: [] })
                    return [...percolatedTags, ...remainingTags]
                }, tagsToConsider)
            }
            else {
                returnValue = arg.reorder(tagsToConsider)
            }
            return [...untouchedPriorTags, ...returnValue, ...untouchedAfterTags]
        }
    }

    //
    // Create a new (likely smaller) tag tree with only the leaf nodes that meet the filtering criteria.
    //
    _filterTags(args: TagTreeFilterArguments<NodeData>) {
        return (tags: TagListItem<NodeData>[]): Boolean => {
            //
            // Recursive match between tagList and a (possibly recursive) MatchOperator
            //
            const filterMatch = (arg: TagTreeFilterArguments<NodeData>, tagList: TagListItem<NodeData>[]): Boolean => {
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
                if ('sequence' in arg) {
                    const matchIndices = this._tagMatch(arg, tagList)
                    return matchIndices.length > 0
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

    get _transformedTags(): TagListItem<NodeData>[][] {
        return this._actions.reduce<TagListItem<NodeData>[][]>((previous, action) => {
            if (isTagTreeActionReorder(action) || isTagTreeActionReorderFunctional(action)) {
                const reorderedTags = previous.map((tagList) => (this._reorderTags(action)(tagList)))
                return reorderedTags
            }
            if (isTagTreeActionReorderSiblings(action)) {
                const reorderedSiblingTree = previous.reduce<GenericTree<NodeData>>(iterativeMerge<NodeData>({
                    classify: this._classifier,
                    compare: this._compare,
                    orderIndependence: this._orderIndependence,
                    orderIndependenceIgnore: this._orderIndependenceIgnore,
                    orderSort: action.reorderSiblings,
                    merge: this._merge
                }), [])
                return tagListFromTree(reorderedSiblingTree, { isWrapper: this._isWrapper })
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

    clone(): TagTree<NodeData> {
        const returnValue = new TagTree<NodeData>({
            tree: [],
            classify: this._classifier,
            compare: this._compare,
            merge: this._merge,
            orderIndependence: this._orderIndependence,
            orderIndependenceIgnore: this._orderIndependenceIgnore
        })
        returnValue._tagList = this._tagList
        returnValue._actions = this._actions
        return returnValue
    }

    reordered(orderGroups: TagTreePruneArgs<NodeData>[]): TagTree<NodeData> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { reorder: orderGroups }]
        return returnValue
    }

    reorderFunctional(matches: TagTreePruneArgs<NodeData>[], reorder: (tags: TagListItem<NodeData>[]) => TagListItem<NodeData>[]): TagTree<NodeData> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { matches, reorder }]
        return returnValue
    }

    _tagMatchOperationIndices(tags: TagListItem<NodeData>[], operation: TagTreeMatchOperation<NodeData>, recurse?: (operation: TagTreeMatchOperation<NodeData>) => number[]): number[] {
        const indicesMatching = (operand: TagTreeMatchOperand<NodeData>): number[] => {
            if (typeof operand === 'function') {
                const { output } = tags.reduce<{ output: number[], stack: NodeData[] }>((previous, node, index) => {
                    return {
                        output: (operand as (value: { data: NodeData }, stack: NodeData[]) => boolean)(node, previous.stack) ? [...previous.output, index] : previous.output,
                        stack: [...previous.stack, node.data]
                    }
                }, { output: [], stack: [] })
                return output
            }
            return tags.map((node, index) => {
                if (typeof operand === 'string' && this._classifier(node.data) === operand) {
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
    filter(args: TagTreeFilterArguments<NodeData>): TagTree<NodeData> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { filter: args }]
        return returnValue
    }

    //
    // Create a tag tree with less levels by pruning specified tags out of the lists
    //
    prune(args: TagTreePruneArgs<NodeData>): TagTree<NodeData> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { prune: args }]
        return returnValue
    }

    reorderedSiblings(orderSort: string[][]): TagTree<NodeData> {
        const returnValue = this.clone()
        returnValue._actions = [...this._actions, { reorderSiblings: orderSort }]
        return returnValue
    }

}

export default TagTree

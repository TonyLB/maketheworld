import { deepEqual } from "../lib/objects";
import { GenericTree } from "../sequence/tree/baseClasses"
import dfsWalk from "../sequence/tree/dfsWalk";

type TagTreeTreeOptions<NodeData extends {}> = {
    classify: (data: NodeData) => string;
    compare?: (A: NodeData, B: NodeData) => boolean;
    orderIndependence?: string[][];
}

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

export const iterativeMerge = <NodeData extends {}>(options?: TagTreeTreeOptions<NodeData>) => (previous: GenericTree<NodeData>, tagItem: NodeData[]): GenericTree<NodeData> => {
    if (!tagItem.length) {
        return previous
    }
    const compare = options?.compare ?? deepEqual
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
    // TODO: Design what information needs to be passed to reordered in order
    // to let it operate
    //
    reordered(orderGroups: string[]): TagTree<NodeData> {
        const returnValue = new TagTree<NodeData>({ tree: [], classify: this._classifier, compare: this._compare, orderIndependence: this._orderIndependence })
        returnValue._tagList = this._tagList.map(this._reorderTags(orderGroups))
        return returnValue
    }
}

export default TagTree

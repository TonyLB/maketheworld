import { deepEqual } from "../lib/objects";
import { GenericTree } from "../sequence/tree/baseClasses"
import dfsWalk from "../sequence/tree/dfsWalk";

type TagTreeLeafNode<NodeData extends {}> = NodeData[]

type TagTreeTreeOptions = {
    reorderTags?: string[];
}

export const iterativeMerge = <NodeData extends {}>(previous: GenericTree<NodeData>, tagItem: NodeData[]): GenericTree<NodeData> => {
    if (!tagItem.length) {
        return previous
    }
    if (previous.length) {
        const lastPrevious = previous.slice(-1)[0]
        if (deepEqual(lastPrevious.data, tagItem[0])) {
            return [...previous.slice(0, -1), { data: lastPrevious.data, children: iterativeMerge(lastPrevious.children, tagItem.slice(1)) }]
        }
    }
    return [...previous, { data: tagItem[0], children: iterativeMerge([], tagItem.slice(1)) }]
}

export class TagTree<NodeData extends {}> {
    _tagList: NodeData[][];

    constructor(tree: GenericTree<NodeData>) {
        this._tagList = dfsWalk<NodeData, NodeData[][], {}>({
            default: { output: [], state: {} },
            callback: (previous: { output: NodeData[][], state: {} }, data: NodeData) => {
                return { output: [...previous.output, [data]], state: {} }
            },
            aggregate: ({ direct, children, data }) => {
                return {
                    output: children.output.length ? children.output.map((nodes) => ([...(data ? [data] : []), ...nodes])) : direct.output,
                    state: {}
                }
            }
        })(tree)
    }

    tree(options?: TagTreeTreeOptions) {
        return this._tagList.reduce<GenericTree<NodeData>>(iterativeMerge, [])
    }
}

export default TagTree

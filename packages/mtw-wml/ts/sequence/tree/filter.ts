import { GenericTree } from './baseClasses'

export const filter = <NodeData extends {}>({ tree, callback }: { tree: GenericTree<NodeData>, callback: (value: NodeData) => boolean }): GenericTree<NodeData> => (
    tree
        .filter(({ data }) => (callback(data)))
        .map(({ data, children }) => ({ data, children: filter({ tree: children, callback })}))
)

export const asyncFilter = async <NodeData extends {}>({ tree, callback }: { tree: GenericTree<NodeData>, callback: (value: NodeData) => Promise<boolean> }): Promise<GenericTree<NodeData>> => {
    return (await Promise.all(
        tree.map(async ({ data, children }) => {
            if (await callback(data)) {
                return [{
                    data,
                    children: await asyncFilter({ tree: children, callback })
                }]
            }
            else {
                return []
            }
        })
    )).flat(1)
}

export const treeTypeGuard = <NodeData extends {}, NewNodeData extends NodeData>({ tree, typeGuard }: { tree: GenericTree<NodeData>, typeGuard: (value: NodeData) => value is NewNodeData }): GenericTree<NewNodeData> => (
    tree.map(({ data, children }) => (
        typeGuard(data)
            ?  [{ data, children: treeTypeGuard({ tree: children, typeGuard })}]
            : []
    )).flat(1)
)

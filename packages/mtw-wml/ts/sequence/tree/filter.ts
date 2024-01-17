import { TreeCallbackNode, GenericTree, TreeCallback } from './baseClasses'

export const filter = <Callback extends TreeCallback<boolean>>({ tree, callback }: { tree: TreeCallbackNode<Callback>[], callback: Callback }): TreeCallbackNode<Callback>[] => (
    tree
        .filter(({ data, children, ...rest }) => (callback(data, rest)))
        .map(({ data, children, ...rest }) => ({ data, children: filter({ tree: children as TreeCallbackNode<Callback>[], callback }), ...rest } as unknown as TreeCallbackNode<Callback>))
)

export const asyncFilter = async <Callback extends TreeCallback<Promise<boolean>>>({ tree, callback }: { tree: TreeCallbackNode<Callback>[], callback: Callback }): Promise<TreeCallbackNode<Callback>[]> => {
    return (await Promise.all(
        tree.map(async ({ data, children, ...rest }) => {
            if (await callback(data, rest)) {
                return [{
                    data,
                    children: await asyncFilter({ tree: children as TreeCallbackNode<Callback>[], callback }),
                    ...rest
                }] as unknown as TreeCallbackNode<Callback>[]
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

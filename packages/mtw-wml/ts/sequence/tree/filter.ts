import { GenericTree, GenericTreeNode } from './baseClasses'

type CallbackNode<Callback extends (...args: any) => any> = Parameters<Callback>[0] extends {} ? Parameters<Callback>[1] extends {} ? GenericTreeNode<Parameters<Callback>[0], Parameters<Callback>[1]> : GenericTreeNode<Parameters<Callback>[0]> : never

export const filter = <Callback extends (...args: any) => boolean>({ tree, callback }: { tree: CallbackNode<Callback>[], callback: Callback }): CallbackNode<Callback>[] => (
    tree
        .filter(({ data, children, ...rest }) => (callback(data, rest)))
        .map(({ data, children, ...rest }) => ({ data, children: filter({ tree: children as CallbackNode<Callback>[], callback }), ...rest } as unknown as CallbackNode<Callback>))
)

export const asyncFilter = async <Callback extends (...args: any) => Promise<boolean>>({ tree, callback }: { tree: CallbackNode<Callback>[], callback: Callback }): Promise<CallbackNode<Callback>[]> => {
    return (await Promise.all(
        tree.map(async ({ data, children, ...rest }) => {
            if (await callback(data, rest)) {
                return [{
                    data,
                    children: await asyncFilter({ tree: children as CallbackNode<Callback>[], callback }),
                    ...rest
                }] as unknown as CallbackNode<Callback>[]
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

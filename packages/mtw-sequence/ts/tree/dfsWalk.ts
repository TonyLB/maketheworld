import { GenericTree, GenericTreeNode } from "./baseClasses"

type DFSWalkOptions<IncomingType, Output, State> = {
    default: { output: Output; state: State };
    callback: (previous: { output: Output; state: State }, data: IncomingType) => { output: Output; state: State };
}

const dfsWalkHelper = <IncomingType, Output, State>(options: DFSWalkOptions<IncomingType, Output, State>) => (previous: { output: Output; state: State }, node: GenericTreeNode<IncomingType>): { output: Output; state: State } => {
    return node.children.reduce(dfsWalkHelper(options), options.callback(previous, node.data))
}

export const dfsWalk = <IncomingType, Output, State>(options: DFSWalkOptions<IncomingType, Output, State>) => (tree: GenericTree<IncomingType>): Output => {
    const { output } = tree.reduce(dfsWalkHelper(options), options.default)
    return output
}

export default dfsWalk

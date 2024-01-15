import { GenericTree, GenericTreeID, GenericTreeIDNode, GenericTreeNode } from "./baseClasses"

type DFSWalkReduce<Output, State> = {
    output: Output;
    state: State;
}

type DFSWalkOptionsBase<IncomingType extends {}, Output, State, Extra extends {}> = {
    default: DFSWalkReduce<Output, State>;
    callback: (previous: DFSWalkReduce<Output, State>, data: IncomingType, extra: Extra) => DFSWalkReduce<Output, State>;
    nest?: (value: { state: State, data: IncomingType }) => State;
    unNest?: (value: { previous: State; state: State; data: IncomingType }) => State;
    aggregate?: (value: { direct: DFSWalkReduce<Output, State>; children: DFSWalkReduce<Output, State>; data?: IncomingType }) => DFSWalkReduce<Output, State>
}

type DFSWalkOptionsVerbose<IncomingType extends {}, Output, State, Extra extends {}> = DFSWalkOptionsBase<IncomingType, Output, State, Extra> & {
    returnVerbose: true;
}

type DFSWalkOptionsTerse<IncomingType extends {}, Output, State, Extra extends {}> = DFSWalkOptionsBase<IncomingType, Output, State, Extra> & {
    returnVerbose?: false;
}

type DFSWalkOptions<IncomingType extends {}, Output, State, Extra extends {}> = DFSWalkOptionsVerbose<IncomingType, Output, State, Extra> |
    DFSWalkOptionsTerse<IncomingType, Output, State, Extra>

const dfsWalkHelper = <IncomingType extends {}, Output, State, Node extends GenericTreeNode<IncomingType> | GenericTreeIDNode<IncomingType>>(options: DFSWalkOptions<IncomingType, Output, State, Omit<Node, 'data' | 'children'>>) => (previous: { output: Output; state: State }, node: Node): { output: Output; state: State } => {
    const { data, children, ...rest } = node
    const firstCallback = options.callback(previous, node.data, rest as unknown as Omit<Node, 'data' | 'children'>)
    if (options.aggregate) {
        const childCallbacks = (node.children as Node[]).reduce(dfsWalkHelper(options), { output: options.default.output, state: options.nest ? options.nest({ state: firstCallback.state, data: node.data }) : firstCallback.state })
        const allCallbacks = options.aggregate({ direct: firstCallback, children: childCallbacks, data: node.data })
        return options.unNest ? { ...allCallbacks, state: options.unNest({ previous: firstCallback.state, state: allCallbacks.state, data: node.data }) } : allCallbacks
    }
    else {
        const allCallbacks = (node.children as Node[]).reduce(dfsWalkHelper(options), options.nest ? { ...firstCallback, state: options.nest({ state: firstCallback.state, data: node.data }) } : firstCallback)
        return options.unNest ? { ...allCallbacks, state: options.unNest({ previous: firstCallback.state, state: allCallbacks.state, data: node.data }) } : allCallbacks    
    }
}

function dfsWalk<IncomingType extends {}, Output, State, Node extends GenericTreeNode<IncomingType> | GenericTreeIDNode<IncomingType>>(options: DFSWalkOptionsVerbose<IncomingType, Output, State, Omit<Node, 'data' | 'children'>>): (tree: Node[]) => { output: Output; state: State }
function dfsWalk<IncomingType extends {}, Output, State, Node extends GenericTreeNode<IncomingType> | GenericTreeIDNode<IncomingType>>(options: DFSWalkOptionsTerse<IncomingType, Output, State, Omit<Node, 'data' | 'children'>>): (tree: Node[]) => Output
function dfsWalk<IncomingType extends {}, Output, State, Node extends GenericTreeNode<IncomingType> | GenericTreeIDNode<IncomingType>>(options: DFSWalkOptions<IncomingType, Output, State, Omit<Node, 'data' | 'children'>>): (tree: Node[]) => Output | { output: Output; state: State } {
    return (tree: Node[]): Output | { output: Output; state: State } => {
        const returnValue = options.aggregate ? options.aggregate({ direct: options.default, children: tree.reduce(dfsWalkHelper(options), options.default) }) : tree.reduce(dfsWalkHelper(options), options.default)
        if (options.returnVerbose) {
            return returnValue
        }
        else {
            return returnValue.output
        }
    }
}

export default dfsWalk

import { GenericTree, GenericTreeNode } from "./baseClasses"

type DFSWalkOptionsBase<IncomingType, Output, State> = {
    default: { output: Output; state: State };
    callback: (previous: { output: Output; state: State }, data: IncomingType) => { output: Output; state: State };
    nest?: (value: { state: State, data: IncomingType }) => State;
    unNest?: (value: { previous: State; state: State; data: IncomingType }) => State;
}

type DFSWalkOptionsVerbose<IncomingType, Output, State> = DFSWalkOptionsBase<IncomingType, Output, State> & {
    returnVerbose: true;
}

type DFSWalkOptionsTerse<IncomingType, Output, State> = DFSWalkOptionsBase<IncomingType, Output, State> & {
    returnVerbose?: false;
}

type DFSWalkOptions<IncomingType, Output, State> = DFSWalkOptionsVerbose<IncomingType, Output, State> |
    DFSWalkOptionsTerse<IncomingType, Output, State>

const dfsWalkHelper = <IncomingType, Output, State>(options: DFSWalkOptions<IncomingType, Output, State>) => (previous: { output: Output; state: State }, node: GenericTreeNode<IncomingType>): { output: Output; state: State } => {
    const firstCallback = options.callback(previous, node.data)
    const allCallbacks = node.children.reduce(dfsWalkHelper(options), options.nest ? { ...firstCallback, state: options.nest({ state: firstCallback.state, data: node.data }) } : firstCallback)
    return options.unNest ? { ...allCallbacks, state: options.unNest({ previous: firstCallback.state, state: allCallbacks.state, data: node.data }) } : allCallbacks
}

function dfsWalk<IncomingType, Output, State>(options: DFSWalkOptionsVerbose<IncomingType, Output, State>): (tree: GenericTree<IncomingType>) => { output: Output; state: State }
function dfsWalk<IncomingType, Output, State>(options: DFSWalkOptionsTerse<IncomingType, Output, State>): (tree: GenericTree<IncomingType>) => Output
function dfsWalk<IncomingType, Output, State>(options: DFSWalkOptions<IncomingType, Output, State>): (tree: GenericTree<IncomingType>) => Output | { output: Output; state: State } {
    return (tree: GenericTree<IncomingType>): Output | { output: Output; state: State } => {
        const returnValue = tree.reduce(dfsWalkHelper(options), options.default)
        if (options.returnVerbose) {
            return returnValue
        }
        else {
            return returnValue.output
        }
    }
}

export default dfsWalk

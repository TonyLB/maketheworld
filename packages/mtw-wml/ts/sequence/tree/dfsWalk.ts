import { GenericTreeNode } from "./baseClasses"

//
// TODO: Create type handler to extract callback function from incoming options, and use it to validate
// the entire option property against the callback
//
type DFSWalkReduce<Callback extends (...args: any) => any> = 
    Parameters<Callback> extends [previous: { output: infer Output, state: infer State }, ...args: any]
        ? ReturnType<Callback> extends { output: Output, state: State }
            ? { output: Output, state: State }
            : never
        : never
type ValidDFSWalkCallback<Callback extends (...args: any) => any> =
    ReturnType<Callback> extends infer Return extends DFSWalkReduce<Callback>
        ? Parameters<Callback> extends [Return, infer Data, infer Extra]
            ? (previous: Return, data: Data, extra: Extra) => Return
            : Parameters<Callback> extends [Return, infer Data]
                ? (previous: Return, data: Data) => Return
                : never
        : never
type DFSWalkState<Callback extends (...args: any) => any> = DFSWalkReduce<Callback>["state"]
type DFSWalkIncomingType<Callback extends (...args: any) => any> =
    Parameters<Callback> extends [{ output: infer Output, state: infer State }, infer Data extends {}, infer Extra extends {}]
        ? GenericTreeNode<Data, Extra>
        : Parameters<Callback> extends [{ output: infer Output, state: infer State }, infer Data extends {}]
            ? GenericTreeNode<Data>
            : never

type DFSWalkOptionsBase<Callback extends (...args: any) => any> = {
    default: DFSWalkReduce<Callback>;
    callback: ValidDFSWalkCallback<Callback>;
    nest?: (args: { state: DFSWalkState<Callback>, data: DFSWalkIncomingType<Callback>["data"] }) => DFSWalkState<Callback>;
    unNest?: (value: { previous: DFSWalkState<Callback>; state: DFSWalkState<Callback>; data: DFSWalkIncomingType<Callback>["data"] }) => DFSWalkState<Callback>;
    aggregate?: (value: { direct: DFSWalkReduce<Callback>; children: DFSWalkReduce<Callback>; data?: DFSWalkIncomingType<Callback>["data"] }) => DFSWalkReduce<Callback>
}

type DFSWalkOptionsVerbose<Callback extends (...args: any) => any> = DFSWalkOptionsBase<Callback> & {
    returnVerbose: true;
}

type DFSWalkOptionsTerse<Callback extends (...args: any) => any> = DFSWalkOptionsBase<Callback> & {
    returnVerbose?: false;
}

type DFSWalkOptions<Callback extends (...args: any) => any> = DFSWalkOptionsVerbose<Callback> |
    DFSWalkOptionsTerse<Callback>

const dfsWalkHelper = <Callback extends (...args: any) => any>(options: DFSWalkOptions<Callback>) => (previous: DFSWalkReduce<Callback>, node: DFSWalkIncomingType<Callback>): DFSWalkReduce<Callback> => {
    const { data, children, ...rest } = node
    const firstCallback = options.callback(previous, node.data, rest)
    if (options.aggregate) {
        const childCallbacks = (children as DFSWalkIncomingType<Callback>[]).reduce(dfsWalkHelper<Callback>(options), { output: options.default.output, state: options.nest ? options.nest({ state: firstCallback.state, data }) : firstCallback.state } as DFSWalkReduce<Callback>)
        const allCallbacks = options.aggregate({ direct: firstCallback, children: childCallbacks, data })
        return options.unNest ? { ...allCallbacks, state: options.unNest({ previous: firstCallback.state, state: allCallbacks.state, data }) } : allCallbacks
    }
    else {
        const allCallbacks = (children as DFSWalkIncomingType<Callback>[]).reduce(dfsWalkHelper(options), options.nest ? { ...firstCallback, state: options.nest({ state: firstCallback.state, data }) } : firstCallback)
        return options.unNest ? { ...allCallbacks, state: options.unNest({ previous: firstCallback.state, state: allCallbacks.state, data }) } : allCallbacks    
    }
}

function dfsWalk<Callback extends (...args: any) => any>(options: DFSWalkOptionsVerbose<Callback>): (tree: DFSWalkIncomingType<Callback>[]) => DFSWalkReduce<Callback>
function dfsWalk<Callback extends (...args: any) => any>(options: DFSWalkOptionsTerse<Callback>): (tree: DFSWalkIncomingType<Callback>[]) => DFSWalkReduce<Callback>["output"]
function dfsWalk<Callback extends (...args: any) => any>(options: DFSWalkOptions<Callback>): (tree: DFSWalkIncomingType<Callback>[]) => DFSWalkReduce<Callback> | DFSWalkReduce<Callback>["output"] {
    return (tree: DFSWalkIncomingType<Callback>[]): DFSWalkReduce<Callback> | DFSWalkReduce<Callback>["output"] => {
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

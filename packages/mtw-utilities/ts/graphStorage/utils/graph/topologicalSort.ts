//
// The topologicalSort function is a straightforward implementation of Tarjan's algorithm to
// return strongly connected components, in an ancestor-descendant order of dependency. For
// acyclic graphs (and for acyclic sections of non-acyclic graphs) Tarjan's returns each individual
// node as a seperate strongly connected component.
//

import { Graph } from "."

type TarjanVisitData = {
    index: number;
    lowLink: number;
    onStack: boolean;
}

type TarjanRecursiveReduceData<K extends string> = {
    strongComponents: K[][];
    currentStack: K[];
    index: number;
    visitData: Partial<Record<K, TarjanVisitData>>;
}

const tarjanStrongConnect = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>) => (previous: TarjanRecursiveReduceData<K>, node: K): TarjanRecursiveReduceData<K> => {
    if (typeof (previous.visitData[node]?.index) !== 'undefined') {
        return previous
    }
    const initialized = {
        ...previous,
        visitData: {
            ...previous.visitData,
            [node]: {
                index: previous.index,
                lowLink: previous.index,
                onStack: true
            }
        },
        currentStack: [...previous.currentStack, node],
        index: previous.index + 1
    }

    const iterated = graph.edges.filter(({ from }) => (from === node)).reduce<TarjanRecursiveReduceData<K>>((iterator, { to }) => {
        const { visitData } = iterator
        const targetVisitData = visitData[to]
        if (targetVisitData) {
            if (targetVisitData.onStack) {
                return {
                    ...iterator,
                    visitData: {
                        ...iterator.visitData,
                        [node]: {
                            ...iterator.visitData[node],
                            //
                            // Note: The following line looks weird but is correct:  targetVisitData.index, not lowlink
                            //
                            lowLink: Math.min(iterator.visitData[node]?.lowLink ?? Infinity, targetVisitData.index)
                        }
                    }
                }
            }
        }
        else {
            const recursed = tarjanStrongConnect(graph)(iterator, to)
            return {
                ...recursed,
                visitData: {
                    ...recursed.visitData,
                    [node]: {
                        ...recursed.visitData[node],
                        lowLink: Math.min(recursed.visitData[node]?.lowLink ?? Infinity, recursed.visitData[to]?.lowLink ?? Infinity)
                    }
                }
            }
        }
        return iterator
    }, initialized)

    const { visitData: iteratedVisitData } = iterated
    const currentNodeVisitData = iteratedVisitData[node]
    if (!currentNodeVisitData) {
        throw new Error(`Algorithm error in implementation of Tarjan's algorithm`)
    }
    if (currentNodeVisitData.lowLink === currentNodeVisitData.index) {
        const currentNodeIndex = iterated.currentStack.findIndex((value) => (value === node))
        if (currentNodeIndex === -1) {
            throw new Error(`Algorithm indexing error in implementation of Tarjan's algorithm`)
        }
        const newStronglyConnectedComponent = iterated.currentStack.slice(currentNodeIndex)
        return {
            ...iterated,
            currentStack: iterated.currentStack.slice(0, currentNodeIndex),
            strongComponents: [newStronglyConnectedComponent, ...iterated.strongComponents],
            visitData: newStronglyConnectedComponent.reduce<Partial<Record<K, TarjanVisitData>>>((previousVisitData, componentItem) => ({
                ...previousVisitData,
                [componentItem]: {
                    ...previousVisitData[componentItem],
                    onStack: false
                }
            }), iterated.visitData)
        }
    }
    else {
        return iterated
    }
}

export const topologicalSort = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, rootNode?: K): K[][] => {
    if (!graph.directional) {
        throw new Error('generationOrder method is meaningless on undirected graphs')
    }

    const { strongComponents } = (Object.keys(graph.nodes) as K[]).reduce<TarjanRecursiveReduceData<K>>(tarjanStrongConnect(graph), {
        strongComponents: [],
        currentStack: [],
        index: 1,
        visitData: {}
    })
    return strongComponents
}

export default topologicalSort

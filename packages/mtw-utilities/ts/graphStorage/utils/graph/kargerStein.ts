//
// This implementation of a modified Karger-Stein stochastic minimum-cut algorithm takes a completely connected
// graph and returns a sequence of lists of connected sub-graphs (each below the threshold size), such that:
//    - Each edge is represented in precisely one graph in the total sequence of lists
//    - Each element in the sequence is comprised of a list of graphs with no shared vertices in common (so
//      they can be operated on completely independently in the context of just that sequence-item)
//    - By nature of the Karger-Stein algorithm, the list of the sequence is *probably* minimized.
//
// One application is for graphUpdate, in which updates are written to edges and a denormalizing update written
// to each node in a graph:  Graphs within a single sequence item can be updated in parallel.  Separate sequence
// items need to be written serially to avoid clashing.
//
// TODO: Figure out how the low-level primitives could be rewritten such that they use (for instance) set operators
// add and remove, and therefore can be run without condition expressions (ergo, run completely in parallel without
// any chance of interference).
//

import { Graph } from "."
import { unique } from "../../../lists";
import { objectEntryMap, objectFilter } from "../../../objects";
import { GraphEdge } from "./baseClasses";

type KargerSteinReturn<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    subGraphs: Graph<K, T, E>[];
    cutSet: Graph<K, T, E>;
}

type KargerSteinMergeLabel<K extends string> = {
    key: K;
    nodesAndEdges: number;
}

type KargerSteinMergeSet<K extends string> = Partial<Record<K, KargerSteinMergeLabel<K>>>

//
// KargerSteinState is a class to hold the iteration state of the modified Karger-Stein algorithm
//
class KargerSteinState<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> {
    _baseGraph: Graph<K, T, E>;
    _nodeClusters: K[][];

    constructor(baseGraph: Graph<K, T, E>, nodeClusters: K[][] = []) {
        this._baseGraph = baseGraph
        this._nodeClusters = nodeClusters
    }

    findSubGraphIndex(node: K): number {
        return this._nodeClusters.findIndex((nodes) => (nodes.includes(node)))
    }

    //
    // cutSet is the set of nodes and edges that are still potentially in the final cut set. cutSet will likely
    // share nodes with many (perhaps all) subGraphs. cutSet will not share any edges in common with any subGraph.
    // Together, the set of all edges (cutSet and subGraphs) will always include all edges of the original graph
    // to be segmented.
    //
    get cutSet(): Graph<K, T, E> {
        const cutSetEdges = this._baseGraph.edges.filter(({ from, to }) => {
            const indexA = this.findSubGraphIndex(from)
            const indexB = this.findSubGraphIndex(to)
            return (indexA === -1 || indexA !== indexB)
        })
        const cutSetNodes = unique(cutSetEdges.map(({ from, to }) => ([from, to])).flat())
        return new Graph<K, T, E>(Object.assign({}, ...(cutSetNodes.map((node) => ({ [node]: { key: node }})))), cutSetEdges, this._baseGraph._default, this._baseGraph.directional)
    }
    //
    // subGraphs are connected components that have been grouped by the algorithm. Each subGraph has a set of nodes
    // that are distinct from the nodes of any other subGraph.
    //
    get subGraphs(): Graph<K, T, E>[] {
        return this._nodeClusters.map((nodes) => (this._baseGraph.filter({ keys: nodes })))
    }


    //
    // Given a potential subGraph, test whether it is small enough to meet the threshold requirements of the
    // grouping algorithm.
    //
    edgeMergeValid(edge: GraphEdge<K, E>, threshold: number): boolean {
        const indexA = this.findSubGraphIndex(edge.from)
        const indexB = this.findSubGraphIndex(edge.to)

        const proposedNodes = unique(
            [edge.from, edge.to],
            indexA >= 0 ? this._nodeClusters[indexA] : [],
            indexB >= 0 ? this._nodeClusters[indexB] : []
        )
        const subGraph = this._baseGraph.filter({ keys: proposedNodes })
        return (Object.keys(subGraph.nodes).length + subGraph.edges.length) < threshold
    }

    //
    // Given two subGraphs that are connected (in the cutSet) by at least one edge, return a new KargerSteinState
    // that combines the two into a single larger subGraph component, and merges all connecting edges from cutSet.
    //
    mergeSubGraphs(edge: GraphEdge<K, E>): KargerSteinState<K, T, E> {
        const indexA = this.findSubGraphIndex(edge.from)
        const indexB = this.findSubGraphIndex(edge.to)
        const newCluster = unique(
            [edge.from, edge.to],
            indexA >= 0 ? this._nodeClusters[indexA] : [],
            indexB >= 0 ? this._nodeClusters[indexB] : []
        )

        const untouchedClusters = this._nodeClusters.filter((_, index) => (index !== indexA && index !== indexB))

        return new KargerSteinState<K, T, E>(this._baseGraph, [...untouchedClusters, newCluster])
    }
}

export const countMergedNodesAndEdges = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, mergeLabels: KargerSteinMergeSet<K>, edge: GraphEdge<K, E>): number => {
    const fromLabel = mergeLabels[edge.from]?.key || edge.from
    const toLabel = mergeLabels[edge.to]?.key || edge.to
    const edgeCount = graph.edges.filter(({ from, to }) => ([fromLabel, toLabel].includes(mergeLabels[from]?.key || from) && [fromLabel, toLabel].includes(mergeLabels[to]?.key || to))).length
    const nodeCount = (Object.keys(graph.nodes) as K[]).filter((key) => ([fromLabel, toLabel].includes(mergeLabels[key]?.key || key))).length
    return edgeCount + nodeCount
}

export const randomInRange = (range: number): number => (Math.floor(Math.random() * range))

export const selectRandomUnmergedEdge = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, mergeLabels: Partial<Record<K, KargerSteinMergeLabel<K>>>, threshold: number): number | undefined => {
    const unmergedEdgeIndices = graph.edges.reduce<number[]>((previous, edge, index) => {
        const { from, to } = edge
        if ((mergeLabels[from]?.key || from) !== (mergeLabels[to]?.key || to)) {
            if (countMergedNodesAndEdges(graph, mergeLabels, edge) < threshold) {
                return [
                    ...previous,
                    index
                ]
            }
        }
        return previous
    }, [])
    
    if (!unmergedEdgeIndices.length) {
        return undefined
    }
    return unmergedEdgeIndices[randomInRange(unmergedEdgeIndices.length)]
}

export const mergeEdge = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, mergeLabels: KargerSteinMergeSet<K>, edge: GraphEdge<K, E>): KargerSteinMergeSet<K>  => {
    const fromLabel = mergeLabels[edge.from]?.key || edge.from
    const toLabel = mergeLabels[edge.to]?.key || edge.to
    const nodesAndEdges = countMergedNodesAndEdges(graph, mergeLabels, edge)
    const newMergeLabel: KargerSteinMergeLabel<K> = {
        key: mergeLabels[edge.from]?.key || edge.from,
        nodesAndEdges
    }
    return {
        ...objectEntryMap(mergeLabels as Record<string, KargerSteinMergeLabel<K>>, (originalKey: string, item: KargerSteinMergeLabel<K>) => {
            if ([fromLabel, toLabel].includes(item.key)) {
                return newMergeLabel
            }
            return item
        }),
        [edge.from]: newMergeLabel,
        [edge.to]: newMergeLabel
    } as KargerSteinMergeSet<K>
}

const kargerSteinIteration = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, threshold: number): KargerSteinMergeSet<K> => {
    let mergeLabels: KargerSteinMergeSet<K> = {}
    while(true) {
        const edgeToMerge = selectRandomUnmergedEdge(graph, mergeLabels, threshold)
        if (typeof edgeToMerge === 'undefined') {
            break
        }
        mergeLabels = mergeEdge(graph, mergeLabels, graph.edges[edgeToMerge])
    }

    return mergeLabels
}

const componentFactory = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, mergeLabels: KargerSteinMergeSet<K>): Graph<K, T, E>[] => {
    const nodesByComponent = Object.keys(graph.nodes).reduce<Partial<Record<K, K[]>>>((previous, key) => (
            mergeLabels[key]
            ? {
                ...previous,
                [(mergeLabels[key].key) as K]: [
                    ...(previous[mergeLabels[key].key] || []),
                    key
                ]
            }
            : previous
        ), {})
    const nodesByLowestComponent = (Object.values(nodesByComponent) as K[][]).reduce<Partial<Record<K, K[]>>>((previous, keys) => ({
        ...previous,
        [keys.sort()[0] as K]: keys
    }), {})

    return Object.keys(nodesByLowestComponent).sort().map((key) => {
        const nodeKeys: K[] = nodesByLowestComponent[key]
        const nodes = objectFilter(graph.nodes as Record<string, { key: K }>, ({ key }) => (nodeKeys.includes(key))) as Partial<Record<K, T>>
        const edges = graph.edges.filter(({ from, to }) => (nodeKeys.includes(from) && nodeKeys.includes(to)))
        return new Graph(nodes, edges, graph._default)
    })
}

const cutSetFactory = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, mergeLabels: KargerSteinMergeSet<K>): Graph<K, T, E> => {
    const edges = graph.edges.filter(({ from, to }) => ((mergeLabels[from]?.key || from) !== (mergeLabels[to]?.key || to)))
    const nodes = edges.reduce<Partial<Record<K, T>>>((previous, { from, to }) => ({
        ...previous,
        [from]: graph.nodes[from],
        [to]: graph.nodes[to]
    }), {})
    return new Graph(nodes, edges, graph._default)
}

export const kargerStein = <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>>(graph: Graph<K, T, E>, threshold: number): KargerSteinReturn<K, T, E> => {
    if ((Object.keys(graph.nodes).length + graph.edges.length) < threshold) {
        return {
            subGraphs: [graph],
            cutSet: new Graph<K, T, E>({}, [], graph._default, graph.directional)
        }
    }

    const mergeLabels = kargerSteinIteration(graph, threshold)
    const cutSet = cutSetFactory(graph, mergeLabels)

    //
    // Test whether the cut-set is below threshold (likely) ... if not, run a second time, then accept the best of the two alternatives
    //
    if (Object.keys(cutSet.nodes).length + cutSet.edges.length >= threshold) {
        const secondMergeLabels = kargerSteinIteration(graph, threshold)
        const secondCutSet = cutSetFactory(graph, secondMergeLabels)
        if (Object.keys(secondCutSet.nodes).length + secondCutSet.edges.length < Object.keys(cutSet.nodes).length + cutSet.edges.length) {
            return {
                subGraphs: componentFactory(graph, secondMergeLabels),
                cutSet: secondCutSet
            }
        }
    }

    return {
        subGraphs: componentFactory(graph, mergeLabels),
        cutSet
    }
}

export default kargerStein

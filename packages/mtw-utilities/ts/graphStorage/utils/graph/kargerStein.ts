//
// This implementation of a modified Karger-Stein stochastic minimum-cut algorithm takes a completely connected
// graph and returns a list of connected sub-graphs (each below the threshold size), along with a (hopefully minimal)
// cut-set of edges that are the removed connective tissue between those subGraphs.
//

import { Graph } from "."
import { objectEntryMap, objectFilter, objectMap } from "../../../objects";
import { GraphEdge } from "./baseClasses";

type KargerSteinReturn<K extends string, T extends { key: K } & Record<string, any>> = {
    subGraphs: Graph<K, T>[];
    cutSet: Graph<K, T>;
}

type KargerSteinMergeLabel<K extends string> = {
    key: K;
    nodesAndEdges: number;
}

type KargerSteinMergeSet<K extends string> = Partial<Record<K, KargerSteinMergeLabel<K>>>

export const countMergedNodesAndEdges = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, mergeLabels: KargerSteinMergeSet<K>, edge: GraphEdge<K>): number => {
    const fromLabel = mergeLabels[edge.from]?.key || edge.from
    const toLabel = mergeLabels[edge.to]?.key || edge.to
    const edgeCount = graph.edges.filter(({ from, to }) => ([fromLabel, toLabel].includes(mergeLabels[from]?.key || from) && [fromLabel, toLabel].includes(mergeLabels[to]?.key || to))).length
    const nodeCount = (Object.keys(graph.nodes) as K[]).filter((key) => ([fromLabel, toLabel].includes(mergeLabels[key]?.key || key))).length
    return edgeCount + nodeCount
}

export const randomInRange = (range: number): number => (Math.floor(Math.random() * range))

export const selectRandomUnmergedEdge = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, mergeLabels: Partial<Record<K, KargerSteinMergeLabel<K>>>, threshold: number): number | undefined => {
    const unmergedEdgeIndices = graph.edges.reduce<number[]>((previous, { from, to }, index) => {
        if ((mergeLabels[from]?.key || from) !== (mergeLabels[to]?.key || to)) {
            if (countMergedNodesAndEdges(graph, mergeLabels, { from, to }) < threshold) {
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

export const mergeEdge = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, mergeLabels: KargerSteinMergeSet<K>, edge: GraphEdge<K>): KargerSteinMergeSet<K>  => {
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

const kargerSteinIteration = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, threshold: number): KargerSteinMergeSet<K> => {
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

const componentFactory = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, mergeLabels: KargerSteinMergeSet<K>): Graph<K, T>[] => {
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
        return new Graph(nodes, edges)
    })
}

const cutSetFactory = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, mergeLabels: KargerSteinMergeSet<K>): Graph<K, T> => {
    const edges = graph.edges.filter(({ from, to }) => ((mergeLabels[from]?.key || from) !== (mergeLabels[to]?.key || to)))
    const nodes = edges.reduce<Partial<Record<K, T>>>((previous, { from, to }) => ({
        ...previous,
        [from]: graph.nodes[from],
        [to]: graph.nodes[to]
    }), {})
    return new Graph(nodes, edges)
}

export const kargerStein = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, threshold: number): KargerSteinReturn<K, T> => {
    if ((Object.keys(graph.nodes).length + graph.edges.length) < threshold) {
        return {
            subGraphs: [graph],
            cutSet: new Graph<K, T>({}, [], graph.directional)
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

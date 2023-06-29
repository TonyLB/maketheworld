//
// This implementation of a modified Karger-Stein stochastic minimum-cut algorithm takes a completely connected
// graph and returns a list of connected sub-graphs (each below the threshold size), along with a (hopefully minimal)
// cut-set of edges that are the removed connective tissue between those subGraphs.
//

import { Graph } from "."
import { objectEntryMap, objectMap } from "../../../objects";
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
    console.log(`edgeCount: ${edgeCount}`)
    const nodeCount = (Object.keys(graph.nodes) as K[]).filter((key) => ([fromLabel, toLabel].includes(mergeLabels[key]?.key || key))).length
    console.log(`nodeCount: ${nodeCount}`)
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

export const kargerStein = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, threshold: number): KargerSteinReturn<K, T> => {
    if ((Object.keys(graph.nodes).length + graph.edges.length) < threshold) {
        return {
            subGraphs: [graph],
            cutSet: new Graph<K, T>({}, [], graph.directional)
        }
    }
    let mergeLabels: KargerSteinMergeSet<K> = {}
    //
    // TODO: Select random edges to merge until there are none remaining
    //

    //
    // TODO: Test whether the edge-set is below threshold (likely) ... if not, run a second time, then accept the best of the two alternatives
    //

    return {
        subGraphs: [],
        cutSet: new Graph<K, T>({}, [], graph.directional)
    }
}

export default kargerStein

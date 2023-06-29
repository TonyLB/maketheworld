//
// This implementation of a modified Karger-Stein stochastic minimum-cut algorithm takes a completely connected
// graph and returns a list of connected sub-graphs (each below the threshold size), along with a (hopefully minimal)
// cut-set of edges that are the removed connective tissue between those subGraphs.
//

import { Graph } from "."
import { GraphEdge } from "./baseClasses";

type KargerSteinReturn<K extends string, T extends { key: K } & Record<string, any>> = {
    subGraphs: Graph<K, T>[];
    cutSet: Graph<K, T>;
}

export const kargerStein = <K extends string, T extends { key: K } & Record<string, any>>(graph: Graph<K, T>, threshold: number): KargerSteinReturn<K, T> => {
    if ((Object.keys(graph.nodes).length + graph.edges.length) < threshold) {
        return {
            subGraphs: [graph],
            cutSet: new Graph<K, T>({}, [], graph.directional)
        }
    }
    return {
        subGraphs: [],
        cutSet: new Graph<K, T>({}, [], graph.directional)
    }
}

export default kargerStein

import { GraphEdge } from "./baseClasses";

//
// TODO: Add directionality (true/false) to the class, and a "edges" getter for nodes that gives
// the edges connected to that node (also a "backEdges" getter for nodes in a directed graph)
//
export class Graph <K extends string, T extends { key: K } & Record<string, any>> {
    nodes: Record<K, T>
    edges: GraphEdge<K>[]

    constructor(nodes: Record<K, T>, edges: GraphEdge<K>[]) {
        this.nodes = { ...nodes }
        this.edges = [...edges]
    }
}

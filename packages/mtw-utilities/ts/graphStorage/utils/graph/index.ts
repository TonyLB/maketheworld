import { GraphEdge } from "./baseClasses";

export class GraphNode <K extends string, T extends { key: K } & Record<string, any>> {
    node?: T
    _edges: GraphEdge<K>[]
    _directional: boolean;
    _key: K;

    constructor(graph: Graph<K, T>, key: K) {
        this._key = key
        this.node = graph.nodes[key]
        this._edges = [...graph.edges]
        this._directional = graph.directional
    }

    get edges(): GraphEdge<K>[] {
        return this._edges.filter(({ from, to }) => (from === this._key || ((!this._directional) && to === this._key)))
    }

    get backEdges(): GraphEdge<K>[] {
        return this._edges.filter(({ from, to }) => (to === this._key || ((!this._directional) && from === this._key)))
    }

}

export class Graph <K extends string, T extends { key: K } & Record<string, any>> {
    nodes: Record<K, T>
    edges: GraphEdge<K>[]
    directional: boolean;

    constructor(nodes: Record<K, T>, edges: GraphEdge<K>[], directional: boolean = false) {
        this.nodes = { ...nodes }
        this.edges = [...edges]
        this.directional = directional
    }

    getNode(key: K): GraphNode<K, T> | undefined {
        const nodeCheck = new GraphNode<K, T>(this, key)
        if (nodeCheck.node) {
            return nodeCheck
        }
        return undefined
    }

    setNode(key: K, node: T): void {
        this.nodes[key] = node
    }
}

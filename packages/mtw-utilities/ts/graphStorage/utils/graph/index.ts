import { deepEqual, objectFilter } from "../../../objects";
import { GraphEdge } from "./baseClasses"

export class GraphNode <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> {
    node?: T
    _edges: GraphEdge<K, E>[]
    _directional: boolean;
    _key: K;

    constructor(graph: Graph<K, T, E>, key: K) {
        this._key = key
        this.node = graph.nodes[key]
        this._edges = [...graph.edges]
        this._directional = graph.directional
    }

    get edges(): GraphEdge<K, E>[] {
        return this._edges.reduce<GraphEdge<K, E>[]>((previous, { from, to, ...rest }) => {
            if (from === this._key) {
                return [
                    ...previous,
                    { from, to, ...rest } as GraphEdge<K, E>
                ]
            }
            if ((!this._directional) && to === this._key) {
                return [
                    ...previous,
                    { from: to, to: from, ...rest } as GraphEdge<K, E>
                ]
            }
            return previous
        }, [])
    }

    get backEdges(): GraphEdge<K, E>[] {
        return this._edges.reduce<GraphEdge<K, E>[]>((previous, { from, to, ...rest }) => {
            if (to === this._key) {
                return [
                    ...previous,
                    { from, to, ...rest } as GraphEdge<K, E>
                ]
            }
            if ((!this._directional) && from === this._key) {
                return [
                    ...previous,
                    { from: to, to: from, ...rest } as GraphEdge<K, E>
                ]
            }
            return previous
        }, [])
    }

}

export class Graph <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> {
    nodes: Partial<Record<K, T>>
    edges: GraphEdge<K, E>[]
    directional: boolean;
    _default: Omit<T, 'key'>;
    _alreadyVisited: K[] = [];

    constructor(nodes: Partial<Record<K, T>>, edges: GraphEdge<K, E>[], defaultItem: Omit<T, 'key'>, directional: boolean = false) {
        this.nodes = { ...nodes }
        this.edges = [...edges]
        this._default = defaultItem
        this.directional = directional
    }

    getNode(key: K): GraphNode<K, T, E> | undefined {
        const nodeCheck = new GraphNode<K, T, E>(this, key)
        if (nodeCheck.node) {
            return nodeCheck
        }
        return undefined
    }

    setNode(key: K, node: Partial<T>): void {
        this.nodes[key] = { ...this.nodes[key], ...node, key } as T
    }

    mapAll(callback: (node: T) => T): void {
        (Object.values(this.nodes) as T[]).forEach((previousNode) => {
            const newNode = callback(previousNode)
            this.setNode(previousNode.key, newNode)
        })
    }

    subGraph(keys: K[]): Graph<K, T, E> {
        return new Graph(
            objectFilter(this.nodes as Record<string, T>, ({ key }) => (keys.includes(key))) as Record<K, T>,
            this.edges.filter(({ from, to }) => (keys.includes(from) && keys.includes(to))),
            this._default,
            this.directional
        )
    }

    merge(graphs: Graph<K, T, E>[], connectingEdges: GraphEdge<K, E>[]): Graph<K, T, E> {
        const nodes = graphs.reduce<Partial<Record<K, T>>>((previous, { nodes }) => ({
            ...previous,
            ...nodes
        }), this.nodes)
        const edges = [this, ...graphs].reduce<GraphEdge<K, E>[]>((previous, { edges }) => ([
            ...previous,
            ...(edges.filter((edge) => (!previous.find((checkEdge) => (deepEqual(edge, checkEdge))))))
        ]), connectingEdges)
        return new Graph(nodes, edges, this._default, this.directional)
    }
    
    _simpleWalkIterator(key: K, callback: (key: K) => void): void {
        if (this._alreadyVisited.includes(key)) {
            return
        }
        this._alreadyVisited.push(key)
        const edges = this.getNode(key)?.edges || []
        edges.forEach(({ to }) => (this._simpleWalkIterator(to, callback)))
        callback(key)
    }

    simpleWalk(key: K, callback: (key: K) => void): void {
        this._alreadyVisited = []
        this._simpleWalkIterator(key, callback)
        this._alreadyVisited = []
    }

    fromRoot(rootKey: K): Graph<K, T, E> {
        let subGraphKeys: K[] = []
        this.simpleWalk(rootKey, (key) => (subGraphKeys.push(key)))
        return this.subGraph(subGraphKeys)
    }

    addEdge(edge: GraphEdge<K, E>): void {
        const { from, to } = edge
        if (!this.nodes[from]) {
            this.nodes[from] = { key: from, ...this._default } as T
        }
        if (!this.nodes[to]) {
            this.nodes[to] = { key: to, ...this._default } as T
        }
        this.edges.push(edge)
    }

    //
    // TODO: ISS2327: Add generationOrder method on directed graphs, returning a sorted list of lists (since some nodes may be in
    // cycles that cannot be ordered relative to each other)
    //
}

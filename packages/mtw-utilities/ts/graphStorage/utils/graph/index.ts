import { objectFilter } from "../../../objects";
import { GraphEdge } from "./baseClasses"

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
        return this._edges.reduce<GraphEdge<K>[]>((previous, { from, to }) => {
            if (from === this._key) {
                return [
                    ...previous,
                    { from, to }
                ]
            }
            if ((!this._directional) && to === this._key) {
                return [
                    ...previous,
                    { from: to, to: from }
                ]
            }
            return previous
        }, [])
    }

    get backEdges(): GraphEdge<K>[] {
        return this._edges.reduce<GraphEdge<K>[]>((previous, { from, to }) => {
            if (to === this._key) {
                return [
                    ...previous,
                    { from, to }
                ]
            }
            if ((!this._directional) && from === this._key) {
                return [
                    ...previous,
                    { from: to, to: from }
                ]
            }
            return previous
        }, [])
    }

}

export class Graph <K extends string, T extends { key: K } & Record<string, any>> {
    nodes: Partial<Record<K, T>>
    edges: GraphEdge<K>[]
    directional: boolean;
    _default: Omit<T, 'key'>;
    _alreadyVisited: K[] = [];

    constructor(nodes: Partial<Record<K, T>>, edges: GraphEdge<K>[], defaultItem: Omit<T, 'key'>, directional: boolean = false) {
        this.nodes = { ...nodes }
        this.edges = [...edges]
        this._default = defaultItem
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

    subGraph(keys: K[]): Graph<K, T> {
        return new Graph(
            objectFilter(this.nodes as Record<string, T>, ({ key }) => (keys.includes(key))) as Record<K, T>,
            this.edges.filter(({ from, to }) => (keys.includes(from) && keys.includes(to))),
            this._default,
            this.directional
        )
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

    addEdge(from: K, to: K): void {
        if (!this.nodes[from]) {
            this.nodes[from] = { key: from, ...this._default } as T
        }
        if (!this.nodes[to]) {
            this.nodes[to] = { key: to, ...this._default } as T
        }
        this.edges.push({ from, to })
    }
}

import { unique } from "../../../lists";
import { deepEqual, objectFilter } from "../../../objects";
import { GraphEdge } from "./baseClasses"
import topologicalSort, { generationOrder } from "./topologicalSort";

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

export type GraphFilterArguments<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    keys?: K[]
}

export type GraphSimpleWalkOptions<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    condition?: (props: { node: T, edge: E, path: E[] }) => true;
    allPaths?: boolean;
}

export type GraphSimpleWalkIteratorOptions<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = GraphSimpleWalkOptions<K, T, E> & {
    previousPath?: E[];
}

type GraphSimpleWalkIteratorInProcess<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    key: K;
    validPaths: E[][];
    completed?: boolean;
}

export class Graph <K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> {
    nodes: Partial<Record<K, T>>
    edges: GraphEdge<K, E>[]
    directional: boolean;
    _default: Omit<T, 'key'>;
    _topologicalSortCache?: K[][];

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

    reverse(): Graph<K, T, E> {
        return new Graph(
            this.nodes,
            this.edges.map(({ from, to, ...rest }) => ({ to: from, from: to, ...rest })) as GraphEdge<K, E>[],
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
    
    //
    // TODO: Extend simpleWalk to progress from a set of keys, rather than a single key, and move forward in waves.
    //

    //
    // TODO: Extend simpleWalk options for edge restriction
    //
    _simpleWalkIterator(key: K, callback: (key: K) => void, options?: GraphSimpleWalkIteratorOptions<K, T, E>): (previous: Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>>) => Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>> {
        return ((previous) => {
            const { condition = () => (true), allPaths = false, previousPath = [] } = options || {}
            const edges = this.getNode(key)?.edges || []
            callback(key)
            return Object.assign(previous,
                //
                // TODO: Remove any paths that have already included this node (to prevent
                // looping paths)
                //

                //
                // TODO: If there are any remaining valid paths, extend them by the edge
                // and add those validPaths to the validPaths for the item in previous (if any)
                //
                ...edges.map((edge) => {
                    return { [edge.to]: {
                        key: edge.to,
                        validPaths: [],
                        completed: previous[edge.to]?.completed
                    } }
                }),
                //
                // Set the current node being visited to have completed: true
                //
                { [key]: {
                    ...previous[key] || { key, validPaths: [] },
                    completed: true
                } }
            )
        }).bind(this)
    }

    //
    // TODO: Refactor simpleWalk to use the new _simpleWalkIterator reducer as long as it returns values that have
    // not yet been completed, successively sorting with topologicalSortOrder, and taking the first incomplete
    // record to iterate on next.
    //
    simpleWalk(key: K, callback: (key: K) => void): void {
        let walkedNodes = {
            [key]: {
                key,
                validPaths: [[]] as E[][],
                completed: false
            }
        } as Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>>
        const sortOrder = this._topologicalSortOrder.bind(this)
        let nextNode: GraphSimpleWalkIteratorInProcess<K, T, E> | undefined
        while(nextNode = (Object.values(walkedNodes) as GraphSimpleWalkIteratorInProcess<K, T, E>[]).sort(sortOrder).find(({ completed }) => (!completed))) {
            walkedNodes = this._simpleWalkIterator(nextNode.key, callback)(walkedNodes)
        }
    }

    fromRoot(rootKey: K): Graph<K, T, E> {
        let subGraphKeys: K[] = []
        this.simpleWalk(rootKey, (key) => (subGraphKeys.push(key)))
        return this.filter({ keys: subGraphKeys })
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
        this._topologicalSortCache = undefined
    }

    topologicalSort(): K[][] {
        if (!this._topologicalSortCache) {
            this._topologicalSortCache = topologicalSort(this)
        }
        return this._topologicalSortCache
    }

    _topologicalSortOrder(a: { key: K }, b: { key: K }): number {
        const sortList = this.topologicalSort()
        const aIndex = sortList.findIndex((keys) => (keys.includes(a.key)))
        const bIndex = sortList.findIndex((keys) => (keys.includes(b.key)))
        if (aIndex === -1 || bIndex === -1) {
            throw new Error('Item not found in topologicalSortOrder')
        }
        return Math.sign(aIndex - bIndex)
    }

    generationOrder(): K[][][] {
        return generationOrder(this)
    }

    async sortedWalk<Previous>(callback: (props: { keys: K[]; previous: Previous[] }) => Promise<Previous>): Promise<void> {
        const generationOrderOutput = this.generationOrder()
        const stronglyConnectedComponentByContents = generationOrderOutput.flat(1).reduce<Partial<Record<K, K>>>(
            (previous, stronglyConnectedComponent) => (stronglyConnectedComponent.reduce<Partial<Record<K, K>>>((aggregator, key) => ({ ...aggregator, [key]: stronglyConnectedComponent[0] }), previous)),
            {}
        )

        let resultPromises: Partial<Record<K, Promise<Previous>>> = {}
        for (const generation of generationOrderOutput) {
            for (const stronglyConnectedComponent of generation) {
                //
                // Find all Edges leading from *outside* keys to *inside* keys. By definition of generationOrder,
                // all those exits should lead to keys that have already been processed, and (therefore) have items
                // in the aggregator records defined above.  Collect all unique SCC representatives that this new set of
                // keys depends from, and deliver the saved Previous outputs to the callback.
                //
                resultPromises[stronglyConnectedComponent[0]] = (async (): Promise<Previous> => {
                    if (stronglyConnectedComponent.length === 0) {
                        throw new Error('sortedWalk error, empty strongly-connected-component encountered')
                    }
                    const dependencyEdges = this.edges
                        .filter(({ to }) => (stronglyConnectedComponent.includes(to)))
                        .filter(({ from }) => (!stronglyConnectedComponent.includes(from)))
                    const dependencyResultPromises = unique(dependencyEdges.map(({ from }) => (from)))
                        .map((dependency) => (stronglyConnectedComponentByContents[dependency]))
                        .map((stronglyConnectedComponentRepresentative) => (
                            stronglyConnectedComponentRepresentative &&
                            resultPromises[stronglyConnectedComponentRepresentative]
                        ))
                        .filter((results) => (typeof results !== 'undefined'))
                    const dependencyResults: Previous[] = (await Promise.all(dependencyResultPromises)).filter((results) => (typeof results !== 'undefined')) as Previous[]
                    return await callback({ keys: stronglyConnectedComponent, previous: dependencyResults })
                })()
            }
        }
        await Promise.all(Object.values(resultPromises))

    }

    filter(props: GraphFilterArguments<K, T, E>): Graph<K, T, E> {
        //
        // TODO: Refactor filter to start from first generation of connected components and simple-walk
        // forward applying conditions as it goes (what does this mean for 'keys' argument?  Would
        // nodes not specified, but required to connect the graph, be included?)
        //
        if ('keys' in props) {
            const { keys } = props
            if (keys) {
                return new Graph(
                    objectFilter(this.nodes as Record<string, T>, ({ key }) => (keys.includes(key))) as Record<K, T>,
                    this.edges.filter(({ from, to }) => (keys.includes(from) && keys.includes(to))),
                    this._default,
                    this.directional
                )
            }
        }
        return this
    }
}

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

export type GraphRestrictArguments<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    fromRoots?: K[];
    nodeCondition?: (node: GraphNode<K, T, E>) => boolean;
    edgeCondition?: (edge: GraphEdge<K, E>) => boolean;
}

type GraphSimpleWalkIteratorInProcess<K extends string, T extends { key: K } & Record<string, any>, E extends Record<string, any>> = {
    key: K;
    edges: E[];
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
    // TODO: Extend simpleWalk options for edge restriction
    //
    _simpleWalkIterator(key: K, options?: GraphRestrictArguments<K, T, E>): (previous: Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>>) => Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>> {
        return ((previous) => {
            const edges = this.getNode(key)?.edges || []
            const incomingPaths = previous[key]?.validPaths || []
            return Object.assign(previous,
                //
                // If there are any valid paths that haven't already visited this node, extend them by the edge
                // and compare those new validPaths to the validPaths for the item in previous
                // (if any).  If any are not already present, add them and set completed back to
                // false
                //
                ...edges.map((edge) => {
                    const targetNode = this.getNode(edge.to)
                    if (options?.nodeCondition && !(targetNode && options.nodeCondition(targetNode))) {
                        return {}
                    }
                    const previousPaths = previous[edge.to]?.validPaths || []
                    const validExtendedPaths = incomingPaths
                        .filter((path) => (!path.find(({ from }) => (from === edge.to))))
                        .map((path) => ([...path, edge]))
                    
                    const uniqueNewPaths = validExtendedPaths.filter((path) => (
                        !previousPaths.find((previousPath) => (deepEqual(previousPath, path)))
                    ))
                    if (uniqueNewPaths.length > 0) {
                        return { [edge.to]: {
                            key: edge.to,
                            validPaths: [...previousPaths, ...uniqueNewPaths],
                            completed: false
                        } }
                    }
                    else {
                        return {}
                    }
                }),
                //
                // Set the current node being visited to have completed: true
                //
                { [key]: {
                    ...previous[key] || { key, validPaths: [], edges: [] },
                    completed: true
                } }
            )
        }).bind(this)
    }

    simpleWalk(callback: (props: { key: K; edges: GraphEdge<K, E>[] }) => void, options: GraphRestrictArguments<K, T, E> = {}): void {
        //
        // Initialize the start of the search by either accepting the fromRoots option,
        // or taking the first generation of nodes in the graph in its entirety
        //
        let walkedNodes = {} as Record<K, GraphSimpleWalkIteratorInProcess<K, T, E>>
        if (options.fromRoots) {
            walkedNodes = Object.assign(walkedNodes,
                ...options.fromRoots.map((key) => ({
                    [key]: {
                        key,
                        validPaths: [[]],
                        edges: [],
                        completed: false
                    }
                }))
            )
        }
        else {
            const firstGeneration = this.generationOrder()[0].flat()
            walkedNodes = Object.assign(walkedNodes,
                ...firstGeneration.map((key) => ({
                    [key]: {
                        key,
                        validPaths: [[]],
                        edges: [],
                        completed: false
                    }
                }))
            )
        }

        //
        // Walk the graph until no more valid paths remain, aggregating all of the valid nodes and
        // paths into the walkedNodes variable
        //
        const sortOrder = this._topologicalSortOrder.bind(this)
        let nextNode: GraphSimpleWalkIteratorInProcess<K, T, E> | undefined
        while(nextNode = (Object.values(walkedNodes) as GraphSimpleWalkIteratorInProcess<K, T, E>[]).sort(sortOrder).find(({ completed }) => (!completed))) {
            walkedNodes = this._simpleWalkIterator(nextNode.key, options)(walkedNodes)
        }

        //
        // Call callback on all nodes
        //
        this.topologicalSort().flat()
            .filter((nodeKey) => (nodeKey in walkedNodes))
            .forEach((key) => { callback({ key, edges: [] }) })
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

    //
    // filter operates on the graph as a whole, and therefore only accepts conditions that can be executed on individual
    // nodes or edges
    //
    filter(props: GraphFilterArguments<K, T, E>): Graph<K, T, E> {
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

    //
    // restrict operates on the graph and its structure, and therefore accepts conditions that can remove whole branches
    // of connection (not just the node or edge being observed), but is computationally more expensive
    //
    restrict(props: GraphRestrictArguments<K, T, E>): Graph<K, T, E> {
        let subGraphKeys: K[] = []
        this.simpleWalk(({ key }) => (subGraphKeys.push(key)), props)
        return this.filter({ keys: subGraphKeys })
    }
}

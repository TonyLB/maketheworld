import { marshall } from '@aws-sdk/util-dynamodb';
import { ephemeraDB as ephemeraDB } from '../../dynamoDB'
import { unique } from '../../lists';
import { extractConstrainedTag } from '../../types';
import { Graph } from '../utils/graph';
import { GraphEdge } from '../utils/graph/baseClasses';
import { CacheConstructor, DependencyEdge, DependencyNode, isLegalDependencyTag, isDependencyGraphPut, DependencyGraphAction, isDependencyGraphDelete, GraphDBHandler } from './baseClasses'
import { DeferredCache } from './deferredCache';
import GraphEdgeCache, { GraphEdgeData } from './graphEdge';
import GraphNode, { GraphNodeData } from './graphNode';

export class DependencyTreeWalker<T extends Omit<DependencyNode, 'completeness'>> {
    _nodes: T[];
    _alreadyVisited: string[] = [];

    constructor(nodes: T[]) {
        this._nodes = nodes
    }

    _findNode(ephemeraId: string): T | undefined {
        const returnNode = this._nodes.find(({ EphemeraId }) => (EphemeraId === ephemeraId))
        return returnNode
    }

    _walkHelper(props: {
        start: string;
        key?: string;
        assets?: string[];
        callback: (props: { node: T, key?: string; assets?: string[], revisit?: boolean }) => void;
    }): void {
        const { start, key, assets, callback } = props
        const startNode = this._findNode(start)
        if (startNode) {
            const revisit = this._alreadyVisited.includes(start)
            callback({
                node: startNode,
                key,
                assets,
                revisit
            })
            if (!revisit) {
                this._alreadyVisited = unique(this._alreadyVisited, [start]) as string[]
                if (startNode.connections.length) {
                    startNode.connections.forEach((edge) => {
                        this._walkHelper({
                            start: edge.EphemeraId,
                            key: edge.key,
                            assets: edge.assets,
                            callback
                        })
                    })
                }
            }
        }        
    }

    walk(props: {
        start: string;
        callback: (props: { node: T, key?: string; assets?: string[], revisit?: boolean }) => void;
    }): void {
        const { start, callback } = props
        this._alreadyVisited = []
        this._walkHelper({
            start,
            callback
        })
    }

}

export const tagFromEphemeraId = extractConstrainedTag(isLegalDependencyTag)

export const extractTree = <T extends Omit<DependencyNode, 'completeness'>>(tree: T[], EphemeraId: string): T[] => {
    let returnValue: T[] = []
    let walker = new DependencyTreeWalker(tree)
    const callback = ({ node, revisit }: { node: T, revisit?: boolean }) => {
        if (!revisit) {
            returnValue.push(node)
        }
    }
    walker.walk({ start: EphemeraId, callback })
    return returnValue
}

const invertTree = (tree: DependencyNode[]): DependencyNode[] => {
    type ExplicitEdge = {
        from: string;
        to: string;
        key?: string;
        assets: string[];
    }
    const explicitEdges = tree.reduce<ExplicitEdge[]>((previous, { EphemeraId: from , connections }) => (
        connections.reduce<ExplicitEdge[]>((accumulator, { EphemeraId: to, assets, key }) => ([
            ...accumulator,
            {
                from,
                to,
                assets,
                key
            }
        ]), previous)
    ), [])
    return [
        ...(tree.map((node) => ({
            ...node,
            connections: explicitEdges
                .filter(({ to }) => (to === node.EphemeraId))
                .map<DependencyEdge>(({ from, assets, key }) => ({ EphemeraId: from, assets, key }))
        }))),
        ...(Object.values(explicitEdges
            .filter(({ to }) => (!tree.find(({ EphemeraId }) => (to === EphemeraId))))
            .reduce<Record<string, DependencyNode>>((previous, { to, from, key, assets }) => ({
                ...previous,
                [to]: {
                    EphemeraId: to,
                    tag: tagFromEphemeraId(to),
                    assets: [],
                    completeness: 'Partial',
                    connections: [
                        ...(previous[to]?.connections || []),
                        {
                            EphemeraId: from,
                            key,
                            assets
                        }
                    ]
                }
            }), {})
        ))
    ]
}

export const compareEdges = (edgeA: DependencyEdge, edgeB: DependencyEdge) => (
    (edgeA.EphemeraId === edgeB.EphemeraId) &&
    (
        ((typeof edgeA.key === 'undefined') && (typeof(edgeB.key) === 'undefined')) ||
        (edgeA.key === edgeB.key)
    )
)


export const reduceDependencyGraph = (state: Record<string, DependencyNode>, actions: DependencyGraphAction[]) => {
    actions.filter(isDependencyGraphPut)
        .forEach(({ EphemeraId, putItem }) => {
            if (!state[EphemeraId]) {
                state[EphemeraId] = {
                    EphemeraId,
                    completeness: 'Partial',
                    connections: []
                }
            }
            if (!state[putItem.EphemeraId]) {
                state[putItem.EphemeraId] = {
                    EphemeraId: putItem.EphemeraId,
                    completeness: 'Partial',
                    connections: []
                }
            }
            let found = false
            state[EphemeraId].connections.forEach((connection, index) => {
                if (compareEdges(connection, putItem)) {
                    state[EphemeraId].connections[index] = {
                        ...state[EphemeraId].connections[index],
                        assets: unique(
                            connection.assets,
                            putItem.assets
                        ) as string[]
                    }
                    found = true
                }
            })
            if (!found) {
                state[EphemeraId].connections.push(putItem)
            }
        })
    actions.filter(isDependencyGraphDelete)
        .forEach(({ EphemeraId, deleteItem }) => {
            if (state[EphemeraId]) {
                state[EphemeraId].connections
                    .filter((check) => (compareEdges(check, deleteItem)))
                    .forEach((current) => {
                        current.assets = current.assets.filter((asset) => (!(deleteItem.assets.includes(asset))))
                    })
                state[EphemeraId].connections = state[EphemeraId].connections.filter(({ assets }) => (assets.length > 0))
            }
        })

}

export class GraphCacheData {
    dependencyTag: 'Descent' | 'Ancestry';
    _antiDependency?: GraphCacheData;
    _Cache: DeferredCache<DependencyNode>;
    _Store: Record<string, DependencyNode> = {}
    
    constructor(dependencyTag: 'Descent' | 'Ancestry') {
        this.dependencyTag = dependencyTag
        this._Cache = new DeferredCache({
            callback: (key, value) => {
                if (value.completeness === 'Complete' || !this._Store[key]) {
                    this._setStore(key, value)
                }
                else {
                    this._setStore(key, { ...this._Store[key], completeness: 'Complete' })
                }
            },
            defaultValue: (EphemeraId) => ({
                EphemeraId,
                completeness: 'Partial',
                connections: []
            })
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    _setStore(key: string, value: DependencyNode): void {
        this._Store[key] = value
    }

    async get(EphemeraId: string): Promise<DependencyNode[]> {
        const tag = tagFromEphemeraId(EphemeraId)
        if (this.isComplete(EphemeraId)) {
            return this.getPartial(EphemeraId)
        }
        const knownTree = this.getPartial(EphemeraId).map(({ EphemeraId }) => (EphemeraId))
        if (!this._Cache.isCached(EphemeraId)) {
            this._Cache.add({
                promiseFactory: () => (ephemeraDB.getItem<{ Ancestry?: Omit<DependencyNode, 'completeness'>[]; Descent?: Omit<DependencyNode, 'completeness'>[] }>({
                    Key: {
                        EphemeraId,
                        DataCategory: `Meta::${tag}`
                    },
                    ProjectionFields: [this.dependencyTag]
                })),
                requiredKeys: knownTree,
                transform: (fetch) => {
                    const tree = fetch?.[this.dependencyTag] || []
                    return tree.reduce<Record<string, DependencyNode>>((previous, node) => ({ ...previous, [node.EphemeraId]: { completeness: 'Complete', ...node } }), {})
                }
            })
        }
        await Promise.all(knownTree.map((key) => (this._Cache.get(key))))
        return this.getPartial(EphemeraId)
    }

    generationOrder(ephemeraList: string[]): string[][] {
        if (ephemeraList.length === 0) {
            return []
        }
        const dependentItems = ephemeraList.reduce<string[]>((previous, ephemeraId) => ([
            ...previous,
            ...(this.getPartial(ephemeraId)
                .map(({ EphemeraId }) => (EphemeraId))
                .filter((EphemeraId) => (EphemeraId !== ephemeraId))
                .filter((check) => (!(previous.includes(check))))
            )
        ]), [])
        const independent = ephemeraList.filter((value) => (!(dependentItems.includes(value))))
        const dependent = ephemeraList.filter((value) => (dependentItems.includes(value)))
        return [independent, ...this.generationOrder(dependent)]
    }

    async getBatch(ephemeraList: string[]): Promise<DependencyNode[]> {
        const cascadeDependencies = ephemeraList.reduce<string[]>((previous, ephemeraId) => ([
            ...previous,
            ...(this.getPartial(ephemeraId)
                .map(({ EphemeraId }) => (EphemeraId))
                .filter((EphemeraId) => (EphemeraId !== ephemeraId))
                .filter((check) => (!(previous.includes(check))))
            )
        ]), [])
        const minimumFetchSet = ephemeraList.filter((ephemeraId) => (!(cascadeDependencies.includes(ephemeraId))))
        //
        // TODO: Create a batchGetItem analog to the getItem one function above this, in order to add
        // promises as needed, all in batch, rather than do individual gets
        //
        this._Cache.add({
            promiseFactory: () => (ephemeraDB.getItems<{ Ancestry?: Omit<DependencyNode, 'completeness'>[]; Descent?: Omit<DependencyNode, 'completeness'>[] }>({
                Keys: minimumFetchSet.map((EphemeraId) => ({
                    EphemeraId,
                    DataCategory: `Meta::${tagFromEphemeraId(EphemeraId)}`
                })),
                ProjectionFields: [this.dependencyTag]
            })),
            requiredKeys: unique(ephemeraList, cascadeDependencies) as string[],
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, DependencyNode>>((previous, fetch) => {
                    const tree = fetch?.[this.dependencyTag] || []
                    return tree.reduce<Record<string, DependencyNode>>((accumulator, node) => ({ ...accumulator, [node.EphemeraId]: { completeness: 'Complete', ...node } }), previous)
                }, {})
            }
        })
        // await Promise.all(minimumFetchSet.map((ephemeraId) => (this.get(ephemeraId))))
        const individualTrees = await Promise.all(ephemeraList.map((ephemeraId) => (this.get(ephemeraId))))
        return individualTrees.reduce<DependencyNode[]>((previous, tree) => ([
            ...previous,
            ...(tree.filter(({ EphemeraId }) => (!(previous.map(({ EphemeraId }) => (EphemeraId)).includes(EphemeraId)))))
        ]), [])
    }

    getPartial(EphemeraId: string): DependencyNode[] {
        if (EphemeraId in this._Store) {
            return extractTree(Object.values(this._Store), EphemeraId)
        }
        else {
            return [{
                EphemeraId,
                completeness: 'Partial',
                connections: []
            }]
        }
    }

    put(tree: DependencyNode[], nonRecursive?: boolean) {
        tree.forEach((node) => {
            if (node.completeness === 'Complete') {
                this._Cache.set(Infinity, node.EphemeraId, node)
            }
            else {
                if (node.EphemeraId in this._Store) {
                    reduceDependencyGraph(this._Store, node.connections.map((putItem) => ({ EphemeraId: node.EphemeraId, putItem })))
                }
                else {
                    this._Store[node.EphemeraId] = {
                        ...node,
                        completeness: node.completeness ?? 'Partial'
                    }
                }
            }
        })
        if (!nonRecursive) {
            this._antiDependency?.put(invertTree(tree), true)
        }
    }

    delete(EphemeraId: string, edge: DependencyEdge) {
        reduceDependencyGraph(this._Store, [{ EphemeraId, deleteItem: edge }])
    }

    apply(payloads: DependencyGraphAction[]) {
        reduceDependencyGraph(this._Store, payloads)
    }

    invalidate(EphemeraId: string) {
        if (EphemeraId in this._Store) {
            this._Store[EphemeraId].completeness = 'Partial'
        }
    }

    isComplete(EphemeraId: string): boolean {
        if (!(EphemeraId in this._Store)) {
            return false
        }
        const currentNode = this._Store[EphemeraId]
        if (currentNode.completeness === 'Partial') {
            return false
        }
        return currentNode.connections.reduce((previous, { EphemeraId }) => (previous && this.isComplete(EphemeraId)), true)
    }

}

export const LegacyGraphCache = <GBase extends CacheConstructor>(Base: GBase) => {
    return class GraphCache extends Base {
        Descent: GraphCacheData;
        Ancestry: GraphCacheData;

        constructor(...rest: any) {
            super(...rest)
            this.Descent = new GraphCacheData('Descent')
            this.Ancestry = new GraphCacheData('Ancestry')
            this.Descent._antiDependency = this.Ancestry
            this.Ancestry._antiDependency = this.Descent
        }
        override clear() {
            this.Descent.clear()
            this.Ancestry.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.Descent.flush(),
                this.Ancestry.flush(),
                super.flush()
            ])
        }
    }
}

type GraphCacheDataNodeType<K extends string> = {
    key: K;
    cachedAt?: number;
    cache?: string[];
    invalidatedAt?: number;
}

export class NewGraphCacheData <K extends string, DBH extends GraphDBHandler, D extends {}> {
    _Edges: GraphEdgeData<K, DBH, D>;
    _Nodes: GraphNodeData<K, DBH>;
    _dbHandler: DBH;
    _cacheWrites: Promise<void>[] = [];
    
    constructor(Nodes: GraphNodeData<K, DBH>, Edges: GraphEdgeData<K, DBH, D>, dbhHandler: DBH) {
        this._Nodes = Nodes
        this._Edges = Edges
        this._dbHandler = dbhHandler
    }

    async _getIterate(nodes: K[], direction: 'forward' | 'back', previouslyVisited: K[] = []): Promise<Graph<K, { key: K }, { context?: string} & D>> {
        const nodesFetch = (await this._Nodes.get(nodes))
        const rootGraph = new Graph<K, GraphCacheDataNodeType<K>, D>(
            nodesFetch.reduce<Record<K, GraphCacheDataNodeType<K>>>((previous, node) => ({
                ...previous,
                [node.PrimaryKey]: {
                    key: node.PrimaryKey,
                    cachedAt: node[direction].cachedAt,
                    cache: node[direction].cache,
                    invalidatedAt: node[direction].invalidatedAt
                }
            }), {} as Record<K, GraphCacheDataNodeType<K>>),
            [],
            {},
            true
        )
        const newTargets = nodesFetch
            .reduce<K[]>((previous, nodeCache) => (
                unique(
                    previous,
                    nodeCache[direction].edges.map(({ target }) => (target)),
                    (nodeCache[direction].cache || []).map(({ target }) => (target))
                )
            ), [])
            .filter((key) => (![...previouslyVisited, ...nodes].includes(key)))
        const aggregateEdges = nodesFetch.reduce<GraphEdge<K, D>[]>((previous, nodeCache) => ([
            ...previous,
            ...nodeCache[direction].edges
                .map(({ target, context }) => ({ from: nodeCache.PrimaryKey, to: target, context } as unknown as GraphEdge<K, D>))
        ]), [])
        if (newTargets.length) {
            //
            // Prefetch child nodes in batch to facilitate graph calculations
            //
            const subGraph = await this._getIterate(newTargets, direction, [...previouslyVisited, ...nodes])
            return rootGraph.merge([subGraph], aggregateEdges)
        }
        else {
            return rootGraph.merge([], aggregateEdges)
        }

    }

    async get(nodes: K[], direction: 'forward' | 'back'): Promise<Graph<K, { key: K }, D>> {
        const returnValue = await this._getIterate(nodes, direction)

        const moment = Date.now()
        const capitalize = (value: string) => ([value.slice(0, 1).toUpperCase(), value.slice(1)].join(''))
        
        const updateCachePromise = (async () => {
            //
            // TODO: ISS2741: Improve cache update to be more discriminating about which nodes need to be updated
            //
            await Promise.all((Object.values(returnValue.nodes) as { key: K }[])
                .map((node) => {
                    const newCache = returnValue.fromRoot(node.key).edges.map(({ from, to, context }) => (`${from}::${to}${context ? `::${context}`: ''}`))
                    return this._dbHandler.primitiveUpdate({
                        Key: { PrimaryKey: node.key, DataCategory: `Graph::${capitalize(direction)}` },
                        UpdateExpression: 'SET cache = :newCache, cachedAt = :moment',
                        ExpressionAttributeValues: marshall({
                            ':newCache': newCache,
                            ':moment': moment
                        }),
                        ConditionExpression: 'attribute_not_exists(cachedAt) OR cachedAt < :moment'
                    })
                })
            )
        })()
        this._cacheWrites = [...this._cacheWrites, updateCachePromise]

        return returnValue
    }

    async flush() {
        await Promise.all(this._cacheWrites)
        this._cacheWrites = []
    }
}

export const GraphCache = <K extends string, D extends {}, DBH extends GraphDBHandler>(dbHandler: DBH) => <GBase extends ReturnType<ReturnType<typeof GraphNode<K, DBH>>> & ReturnType<ReturnType<typeof GraphEdgeCache<K, D, DBH>>>>(Base: GBase) => {
    return class GraphCache extends Base {
        Graph: NewGraphCacheData<K, DBH, D>;

        constructor(...rest: any) {
            super(...rest)
            this.Graph = new NewGraphCacheData(this.Nodes, this.Edges, dbHandler)
        }

        override async flush() {
            await Promise.all([
                this.Graph.flush(),
                super.flush()
            ])
        }

    }
}

export default LegacyGraphCache


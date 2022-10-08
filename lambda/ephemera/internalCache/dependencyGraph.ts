import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import { splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor, DependencyEdge, DependencyNode, LegalDependencyTag, isLegalDependencyTag, isDependencyGraphPut, DependencyGraphAction, isDependencyGraphDelete } from './baseClasses'
import { DeferredCache } from './deferredCache';

export const tagFromEphemeraId = (EphemeraId: string): LegalDependencyTag => {
    const [upperTag] = splitType(EphemeraId)
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (isLegalDependencyTag(tag)) {
        return tag
    }
    else {
        throw new Error(`Invalid dependency tag: ${tag}`)
    }
}

export const extractTree = <T extends Omit<DependencyNode, 'completeness'>>(tree: T[], EphemeraId: string): T[] => {
    const treeByEphemeraId = tree.reduce((previous, node) => ({ ...previous, [node.EphemeraId]: node }), {} as Record<string, T>)
    if (!(EphemeraId in treeByEphemeraId)) {
        return []
    }
    const currentNode = treeByEphemeraId[EphemeraId]
    return [
        currentNode,
        ...(currentNode.connections.reduce((previous, { EphemeraId }) => ([...previous, ...extractTree(tree, EphemeraId).filter(({ EphemeraId }) => (!(previous.find(({ EphemeraId: check }) => (check === EphemeraId)))))]), [] as T[]))
    ]
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
                    ) as string[]}
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

export class DependencyGraphData {
    dependencyTag: 'Descent' | 'Ancestry';
    _antiDependency?: DependencyGraphData;
    _Cache: DeferredCache<DependencyNode>;
    _Store: Record<string, DependencyNode> = {}
    
    constructor(dependencyTag: 'Descent' | 'Ancestry') {
        this.dependencyTag = dependencyTag
        this._Cache = new DeferredCache({
            callback: (key, value) => { this._setStore(key, value) },
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
                promiseFactory: () => (ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
                    EphemeraId,
                    DataCategory: `Meta::${tag}`,
                    ProjectionFields: [this.dependencyTag]
                })),
                requiredKeys: knownTree,
                transform: (fetch) => {
                    const tree = fetch?.[this.dependencyTag] || []
                    return tree.reduce<Record<string, DependencyNode>>((previous, node) => ({ ...previous, [node.EphemeraId]: node }), {})
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
            promiseFactory: () => (ephemeraDB.batchGetItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
                Items: minimumFetchSet.map((EphemeraId) => ({
                    EphemeraId,
                    DataCategory: `Meta::${tagFromEphemeraId(EphemeraId)}`
                })),
                ProjectionFields: [this.dependencyTag]
            })),
            requiredKeys: unique(ephemeraList, cascadeDependencies) as string[],
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, DependencyNode>>((previous, fetch) => {
                    const tree = fetch?.[this.dependencyTag] || []
                    return tree.reduce<Record<string, DependencyNode>>((accumulator, node) => ({ ...accumulator, [node.EphemeraId]: node }), previous)
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
        return extractTree(Object.values(this._Store), EphemeraId)
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

export const DependencyGraph = <GBase extends CacheConstructor>(Base: GBase) => {
    return class DependencyGraph extends Base {
        Descent: DependencyGraphData;
        Ancestry: DependencyGraphData;

        constructor(...rest: any) {
            super(...rest)
            this.Descent = new DependencyGraphData('Descent')
            this.Ancestry = new DependencyGraphData('Ancestry')
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

export default DependencyGraph

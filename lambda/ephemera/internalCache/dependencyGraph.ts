import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import { splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor, DependencyEdge, DependencyNode, LegalDependencyTag, isLegalDependencyTag, isDependencyGraphPut, DependencyGraphAction, isDependencyGraphDelete, Deferred } from './baseClasses'
import { produce } from 'immer'
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
        ...(currentNode.connections.reduce((previous, { EphemeraId }) => ([...previous, ...extractTree(tree, EphemeraId).filter(({ EphemeraId }) => (!(previous.find(({ EphemeraId: check }) => (check = EphemeraId)))))]), [] as T[]))
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


export const reduceDependencyGraph = (state: Record<string, DependencyNode>, actions: DependencyGraphAction[]): Record<string, DependencyNode> => ({ ...produce(state, (draft) => {
    actions.filter(isDependencyGraphPut)
        .forEach(({ EphemeraId, putItem }) => {
            if (!draft[EphemeraId]) {
                draft[EphemeraId] = {
                    EphemeraId,
                    completeness: 'Partial',
                    connections: []
                }
            }
            if (!draft[putItem.EphemeraId]) {
                draft[putItem.EphemeraId] = {
                    EphemeraId: putItem.EphemeraId,
                    completeness: 'Partial',
                    connections: []
                }
            }
            const current = draft[EphemeraId]
            const match = current.connections.find((check) => (compareEdges(check, putItem)))
            if (match) {
                match.assets = unique(match.assets, putItem.assets) as string[]
            }
            else {
                current.connections.push(putItem)
            }
        })
    actions.filter(isDependencyGraphDelete)
        .forEach(({ EphemeraId, deleteItem }) => {
            if (draft[EphemeraId]) {
                draft[EphemeraId].connections
                    .filter((check) => (compareEdges(check, deleteItem)))
                    .forEach((current) => {
                        current.assets = current.assets.filter((asset) => (!(deleteItem.assets.includes(asset))))
                    })
                draft[EphemeraId].connections = draft[EphemeraId].connections.filter(({ assets }) => (assets.length > 0))
            }
        })

})})

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
            console.log(`Returning partial: ${EphemeraId}`)
            return this.getPartial(EphemeraId)
        }
        const knownTree = this.getPartial(EphemeraId).map(({ EphemeraId }) => (EphemeraId))
        if (!this._Cache.isCached(EphemeraId)) {
            //
            // TODO: Refactor how Deferred entries get created and promises assigned
            //
            console.log(`Adding: ${JSON.stringify(knownTree, null, 4)}`)
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

    getPartial(EphemeraId: string): DependencyNode[] {
        return extractTree(Object.values(this._Store), EphemeraId)
    }

    put(tree: DependencyNode[], nonRecursive?: boolean) {
        tree.forEach((node) => {
            if (node.completeness === 'Complete') {
                this._Cache.set(node.EphemeraId, node)
            }
            else {
                if (node.EphemeraId in this._Store) {
                    this._Store = reduceDependencyGraph(this._Store, node.connections.map((putItem) => ({ EphemeraId: node.EphemeraId, putItem })))
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
        this._Store = reduceDependencyGraph(this._Store, [{ EphemeraId, deleteItem: edge }])
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
                super.flush
            ])
        }
    }
}

export default DependencyGraph

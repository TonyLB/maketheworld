import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import { splitType } from '@tonylb/mtw-utilities/dist/types';
import { CacheConstructor, DependencyEdge, DependencyNode, LegalDependencyTag, isLegalDependencyTag } from './baseClasses'
import { produce } from 'immer'

class Deferred <T>{
    promise: Promise<T>;
    resolve: (value: T) => void = () => {}
    reject: () => void = () => {}
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this.reject = reject
            this.resolve = resolve
        })
    }
}

type DependencyNodeDeferred = Deferred<DependencyNode>

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

const extractTree = (tree: DependencyNode[], EphemeraId: string): DependencyNode[] => {
    const treeByEphemeraId = tree.reduce((previous, node) => ({ ...previous, [node.EphemeraId]: node }), {} as Record<string, DependencyNode>)
    if (!(EphemeraId in treeByEphemeraId)) {
        return []
    }
    const currentNode = treeByEphemeraId[EphemeraId]
    return [
        currentNode,
        ...(currentNode.connections.reduce((previous, { EphemeraId }) => ([...previous, ...extractTree(tree, EphemeraId)]), [] as DependencyNode[]))
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

type DependencyGraphPut = {
    EphemeraId: string;
    putItem: DependencyEdge;
}

type DependencyGraphDelete = {
    EphemeraId: string;
    deleteItem: DependencyEdge;
}

export type DependencyGraphAction = DependencyGraphPut | DependencyGraphDelete

const isDependencyGraphPut = (action: DependencyGraphAction): action is DependencyGraphPut => ('putItem' in action)
const isDependencyGraphDelete = (action: DependencyGraphAction): action is DependencyGraphDelete => ('deleteItem' in action)

export const reduceDependencyGraph = (state: Record<string, DependencyNode>, actions: DependencyGraphAction[]): Record<string, DependencyNode> => (produce(state, (draft) => {
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
                    .filter((check) => (!compareEdges(check, deleteItem)))
                    .forEach((current) => {
                        current.assets = current.assets.filter((asset) => (!(deleteItem.assets.includes(asset))))
                    })
                draft[EphemeraId].connections = draft[EphemeraId].connections.filter(({ assets }) => (assets.length > 0))
            }
        })

}))

export class DependencyGraphData {
    dependencyTag: 'Descent' | 'Ancestry';
    _antiDependency?: DependencyGraphData;
    _Deferred: Record<string, DependencyNodeDeferred> = {}
    _Store: Record<string, DependencyNode> = {}
    
    constructor(dependencyTag: 'Descent' | 'Ancestry') {
        this.dependencyTag = dependencyTag
    }

    clear() {
        Object.values(this._Deferred).forEach(({ resolve }) => { resolve({ EphemeraId: '', connections: [], completeness: 'Partial' }) })
        this._Deferred = {}
        this._Store = {}
    }

    async get(EphemeraId: string): Promise<DependencyNode[]> {
        const tag = tagFromEphemeraId(EphemeraId)
        if (this.isComplete(EphemeraId)) {
            return this.getPartial(EphemeraId)
        }
        if (!(EphemeraId in this._Deferred)) {
            const knownTree = this.getPartial(EphemeraId)
            //
            // TODO: Refactor how Deferred entries get created and promises assigned
            //
            knownTree.forEach((node) => {
                if (!(node.EphemeraId in this._Deferred)) {
                    this._Deferred[node.EphemeraId] = new Deferred<DependencyNode>()
                }
            })
            const helper = async (): Promise<void> => {
                const fetchValue = (await ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
                    EphemeraId: EphemeraId,
                    DataCategory: `Meta::${tag}`,
                    ProjectionFields: [this.dependencyTag]
                }))
                const fetchedNodes = fetchValue?.[this.dependencyTag] || []
                console.log(`Fetch Nodes: ${JSON.stringify(fetchedNodes, null, 4)}`)
                const fetchEphemera = fetchedNodes.map(({ EphemeraId }) => (EphemeraId))
                fetchedNodes.forEach((node) => {
                    this._Deferred[node.EphemeraId]?.resolve(node)
                    this._Store[node.EphemeraId] = node
                })
                //
                // Make sure that, in the case where an item from the known tree is not fetched, it resolves the promise
                // with previous data
                //
                knownTree
                    .filter(({ EphemeraId: check }) => (!(fetchEphemera.includes(check))))
                    .forEach((node) => {
                        this._Deferred[EphemeraId]?.resolve(node)
                        delete this._Deferred[EphemeraId]
                    })
            }
            await helper()
        }
        if (this._Deferred[EphemeraId]) {
            await this._Deferred[EphemeraId].promise
            return this.getPartial(EphemeraId)
        }
        else {
            return []
        }
    }

    getPartial(EphemeraId: string): DependencyNode[] {
        return extractTree(Object.values(this._Store), EphemeraId)
    }

    put(tree: DependencyNode[], nonRecursive?: boolean) {
        tree.forEach((node) => {
            if (node.EphemeraId in this._Store) {
                const current = this._Store[node.EphemeraId]
                if (node.completeness === 'Complete') {
                    current.completeness = 'Complete'
                }
                this._Store = reduceDependencyGraph(this._Store, node.connections.map((putItem) => ({ EphemeraId: node.EphemeraId, putItem })))
            }
            else {
                this._Store[node.EphemeraId] = {
                    ...node,
                    completeness: node.completeness ?? 'Partial'
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
    }
}

export default DependencyGraph

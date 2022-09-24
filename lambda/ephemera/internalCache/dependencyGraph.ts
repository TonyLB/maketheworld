import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { DependencyNodeNonAsset } from '../messageBus/baseClasses';
import { CacheConstructor } from './baseClasses'

type DependencyNodeGraphConnection = {
    EphemeraId: string;
    key?: string;
}

export type DependencyNodeGraphItem = Omit<DependencyNodeNonAsset, 'connections'> & {
    completeness: 'Partial' | 'Complete';
    connections: DependencyNodeGraphConnection[]
}

const isDependencyNodeGraphItem = (value: DependencyNodeNonAsset | DependencyNodeGraphItem): value is DependencyNodeGraphItem => ('completeness' in value)

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

type DependencyNodeGraphDeferred = Deferred<DependencyNodeGraphItem>

export class DependencyGraphData {
    dependencyTag: 'Descent' | 'Ancestry';
    _Promises: Record<string, Promise<DependencyNodeGraphItem>> = {}
    _Deferred: Record<string, DependencyNodeGraphDeferred> = {}
    _Store: Record<string, DependencyNodeGraphItem> = {}
    
    constructor(dependencyTag: 'Descent' | 'Ancestry') {
        this.dependencyTag = dependencyTag
    }

    clear() {
        Object.values(this._Deferred).forEach(({ reject }) => { reject() })
        this._Promises = {}
        this._Deferred = {}
        this._Store = {}
    }

    async get(EphemeraId: string, tag: DependencyNodeNonAsset["tag"]): Promise<DependencyNodeNonAsset> {
        const emptyDefault: DependencyNodeNonAsset = {
            EphemeraId,
            tag,
            assets: [],
            connections: []
        }
        if (this.isComplete(EphemeraId)) {
            return this.getPartial(EphemeraId) ?? emptyDefault
        }
        if (!(EphemeraId in this._Promises)) {
            const knownTree = this.getPartial(EphemeraId) || emptyDefault
            let assignedEphemeraId: string[] = []
            let aggregatePromiseList: Promise<DependencyNodeGraphItem>[] =[]
            const recursivelySetPromises = (node: DependencyNodeNonAsset) => {
                if (!(node.EphemeraId in this._Deferred)) {
                    this._Deferred[node.EphemeraId] = new Deferred<DependencyNodeGraphItem>()
                    assignedEphemeraId.push(node.EphemeraId)
                    aggregatePromiseList.push(this._Deferred[node.EphemeraId].promise)
                }
                node.connections.forEach((child) => { recursivelySetPromises(child) })
            }
            recursivelySetPromises(knownTree)
            const uniqueAssignedEphemeraId = unique(assignedEphemeraId) as string[]
            const aggregatePromise = Promise.all(aggregatePromiseList)
            uniqueAssignedEphemeraId.forEach((EphemeraId) => {
                this._Promises[EphemeraId] = aggregatePromise.then((results) => (results.find(({ EphemeraId: check }) => (check === EphemeraId)) ?? {
                    EphemeraId,
                    tag: 'Computed',
                    assets: [],
                    completeness: 'Complete',
                    connections: []
                }))
            })
            const helper = (async (): Promise<DependencyNodeNonAsset> => {
                const fetchValue = await ephemeraDB.getItem<{ Ancestry?: DependencyNodeNonAsset[]; Descent?: DependencyNodeNonAsset[] }>({
                    EphemeraId: EphemeraId,
                    DataCategory: `Meta::${tag}`,
                    ProjectionFields: [this.dependencyTag]
                })
                if (((value: { Ancestry?: DependencyNodeNonAsset[]; Descent?: DependencyNodeNonAsset[] } | undefined): value is undefined => (typeof value === 'undefined'))(fetchValue)) {
                    return emptyDefault
                }
                return {
                    EphemeraId,
                    tag,
                    assets: [],
                    connections: fetchValue[this.dependencyTag] || []
                }
            })()
            await helper.then((node) => {
                const recursivelyResolve = (node: DependencyNodeNonAsset): void => {
                    const translatedNode: DependencyNodeGraphItem = {
                        EphemeraId: node.EphemeraId,
                        tag: node.tag,
                        assets: node.assets,
                        completeness: 'Complete',
                        connections: node.connections.map(({ EphemeraId, key }) => ({
                            EphemeraId,
                            key,
                        }))
                    }
                    this._Deferred[node.EphemeraId]?.resolve(translatedNode)
                    this._Store[node.EphemeraId] = translatedNode
                    node.connections.forEach((child) => {
                        recursivelyResolve(child)
                    })
                }
                recursivelyResolve(node)
            })
        }
        await this._Promises[EphemeraId]
        return this.getPartial(EphemeraId) || emptyDefault
    }

    getPartial(EphemeraId: string): DependencyNodeNonAsset | undefined {
        if (!(EphemeraId in this._Store)) {
            return undefined
        }
        const { completeness, ...currentNode } = this._Store[EphemeraId]
        const remappedConnections = currentNode.connections
            .map(({ EphemeraId, key }) => {
                const recurse = this.getPartial(EphemeraId)
                if (typeof recurse === 'undefined') {
                    return undefined
                }
                const returnValue = {
                    ...recurse,
                    key
                } as DependencyNodeNonAsset
                return returnValue
            })
        return {
            ...currentNode,
            connections: remappedConnections
                .filter((value: DependencyNodeNonAsset | undefined): value is DependencyNodeNonAsset => (Boolean(value)))
        }
    }

    _putSingle(value: DependencyNodeGraphItem) {
        const EphemeraId = value.EphemeraId
        this._Deferred[EphemeraId]?.resolve(value)
        this._Store[EphemeraId] = value
    }

    put(value: DependencyNodeNonAsset | DependencyNodeGraphItem) {
        if (isDependencyNodeGraphItem(value)) {
            this._putSingle(value)
        }
        else {
            this._putSingle({
                ...value,
                completeness: 'Complete',
                connections: value.connections.map(({ EphemeraId, key }) => ({ EphemeraId, key }))
            })
            value.connections.forEach((child) => { this.put(child) })
        }
    }

    delete(EphemeraId: string, descendant: string) {
        if (EphemeraId in this._Store) {
            this._Store[EphemeraId].connections = this._Store[EphemeraId].connections.filter(({ EphemeraId: check }) => (check !== descendant))
        }
    }

    invalidate(EphemeraId: string) {
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
        }
        override clear() {
            this.Descent.clear()
            this.Ancestry.clear()
            super.clear()
        }
    }
}

export default DependencyGraph

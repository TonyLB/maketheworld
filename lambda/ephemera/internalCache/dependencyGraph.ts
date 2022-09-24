import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
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

type DependencyNodeGraphPromise = {
    promise: Promise<DependencyNodeGraphItem>;
    resolve: (value: DependencyNodeGraphItem) => void;
}

export class DependencyGraphData {
    _Promises: Record<string, DependencyNodeGraphPromise> = {}
    _Store: Record<string, DependencyNodeGraphItem> = {}
    
    clear() {
        this._Promises = {}
        this._Store = {}
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
        if (value.EphemeraId in this._Promises) {
            this._Promises[value.EphemeraId].resolve(value)
        }
        this._Store[value.EphemeraId] = value
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
            super()
            this.Descent = new DependencyGraphData()
            this.Ancestry = new DependencyGraphData()
        }
        override clear() {
            this.Descent.clear()
            this.Ancestry.clear()
            super.clear()
        }
    }
}

export default DependencyGraph

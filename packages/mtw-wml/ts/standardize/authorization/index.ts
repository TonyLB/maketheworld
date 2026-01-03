import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssetUUID, isSchemaAsset, isSchemaAssetUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardAuthorizationItem } from "./components/baseClasses"
import { isStandardAuthorizationCollection, StandardAuthorizationCollectionData } from "./components/dataTypes"
import StandardReference, { referenceSortOrder } from "../components/reference"
import { isSchemaTreeNode, nodeFromWML } from "../../schema"
import { excludeUndefined } from "../../lib/lists"
import processAuthorizations from "./processAuthorizations"
import { isStandardAuthorizationResourceNDJSON, StandardAuthorizationResource, StandardAuthorizationResourceNDJSON } from "./resource"
import { StandardToJSONOptions } from "../components/baseClasses"
import { unique } from "../../list"

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value: T) => value is G): G => {
    if (typeguard(value)) {
        return value
    }
    throw new Error('Type mismatch')
}

export const assertInstance = <C extends { new (...args: any[]) : any }>(value: any, classType: C): InstanceType<C> => {
    if (value instanceof classType) {
        return value
    }
    throw new Error('Type mismatch')
}

export type StandardAuthorizationCollectionGrant = {
    reference?: StandardReference;
    grants: StandardAuthorizationItem[];
}

export type StandardAuthorizationCollectionNDJSON = { tag: 'Asset', universalKey: AssetUUID } | StandardAuthorizationResourceNDJSON

export const isStandardAuthorizationCollectionNDJSON = (value: any): value is StandardAuthorizationCollectionNDJSON => {
    return isStandardAuthorizationResourceNDJSON(value) || Boolean(typeof value === 'object' && value.tag === 'Asset' && isSchemaAssetUUID(value.universalKey))
}

// Helper to check if two component references are equal (handles undefined for global grants)
const componentEqual = (a?: StandardReference, b?: StandardReference): boolean => {
    if (a === undefined && b === undefined) {
        return true  // Both global
    }
    if (a === undefined || b === undefined) {
        return false  // One global, one not
    }
    return a.equal(b)
}

export class StandardAuthorizationCollection {
    _universalKey: AssetUUID;
    _grants: StandardAuthorizationResource[];

    constructor(args: StandardAuthorizationCollectionData | GenericTreeNode<SchemaTag> | string | StandardAuthorizationCollectionNDJSON[]) {
        if (typeof args === 'string' && isSchemaAssetUUID(args)) {
            this._universalKey = args
            this._grants = []
            return
        }
        if (isStandardAuthorizationCollection(args)) {
            // universalKey is required in StandardAuthorizationCollectionData
            this._universalKey = args.universalKey
            this._grants = args.grants.map((standardResource) => new StandardAuthorizationResource(standardResource))
            return
        }
        if (Array.isArray(args) && args.every(isStandardAuthorizationCollectionNDJSON)) {
            const assetKeyRow = args.find((row): row is { tag: 'Asset', universalKey: AssetUUID } => ('tag' in row && row.tag === 'Asset'))
            if (!assetKeyRow) {
                throw new Error('StandardAuthorizationCollection constructor requires an Asset row')
            }
            this._universalKey = assetKeyRow.universalKey
            this._grants = args
                .filter(isStandardAuthorizationResourceNDJSON)
                .reduce<StandardAuthorizationResourceNDJSON[][]>((previous, row) => {
                    const rowComponent = row.component ? new StandardReference(row.component) : undefined
                    const matchingIndex = previous.findIndex(([referenceRow]) => {
                        const refComponent = referenceRow.component ? new StandardReference(referenceRow.component) : undefined
                        return componentEqual(refComponent, rowComponent)
                    })
                    if (matchingIndex === -1) {
                        return [...previous, [row]]
                    }
                    return [...previous.slice(0, matchingIndex), [...previous[matchingIndex], row], ...previous.slice(matchingIndex + 1)]
                }, [])
                .map((row) => (new StandardAuthorizationResource(row)))
            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                if (!node.data.uuid) {
                    throw new Error('StandardAuthorizationCollection constructor requires a uuid')
                }
                this._universalKey = node.data.uuid
                this._grants = []

                this._grants = processAuthorizations({ schema: node.children })
                return
            }
        }
        throw new Error('Invalid arguments in StandardAuthorization constructor')
    }

    get header(): { tag: 'Asset', universalKey: AssetUUID } {
        return {
            tag: 'Asset',
            universalKey: this._universalKey
        }
    }

    get byId(): Record<string, StandardAuthorizationResource> {
        return this._grants.reduce<Record<string, StandardAuthorizationResource>>((previous, resource) => {
            const key = resource.component?.key
            if (!key) {
                return previous
            }
            return {
                ...previous,
                [key]: resource
            }
        }, {})
    }

    get byUniversalId(): Record<string, StandardAuthorizationResource> {
        return this._grants.reduce<Record<string, StandardAuthorizationResource>>((previous, resource) => {
            const universalKey = resource.component?.universalKey
            if (!universalKey) {
                return previous
            }
            return {
                ...previous,
                [universalKey]: resource
            }
        }, {})
    }

    _lookup(reference?: StandardReference): StandardAuthorizationResource | undefined {
        // Find resource by matching component reference
        return this._grants.find((resource) => componentEqual(resource.component, reference))
    }
    
    get global(): StandardAuthorizationItem[] {
        // Global grants are those with undefined component
        const globalResource = this._grants.find((resource) => (resource.component === undefined))
        return globalResource?.grants ?? []
    }
    get universalKey(): AssetUUID { return this._universalKey }

    toJSON(options?: StandardToJSONOptions): StandardAuthorizationCollectionData {
        return {
            universalKey: this._universalKey,
            grants: this._grants.map((resource) => (resource.toJSON()))
        }
    }

    toNDJSON(): StandardAuthorizationCollectionNDJSON[] {
        return [
            this.header,
            ...this._grants.map((resource) => (resource.toNDJSON())).flat(1)
        ]
    }

    _clone(): StandardAuthorizationCollection {
        const returnValue = new StandardAuthorizationCollection(this.universalKey)
        returnValue._grants = this._grants.map((resource) => (resource.clone()))
        return returnValue
    }

    _sortOrderFactory(): (a: StandardAuthorizationResource, b: StandardAuthorizationResource) => number {
        return (a: StandardAuthorizationResource, b: StandardAuthorizationResource) => {
            // Global grants (no component) come first
            if (!a.component && !b.component) return 0
            if (!a.component) return -1
            if (!b.component) return 1
            
            // Use referenceSortOrder for simple tag+key comparison (authorization resources have no parent hierarchy)
            return referenceSortOrder(a.component, b.component)
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const sortOrder = this._sortOrderFactory()
        
        //
        // Separate global grants (undefined component) from component grants
        //
        const globalGrants = this._grants
            .filter((resource) => (resource.component === undefined))
            .flatMap((resource) => (resource.grants.map(grant => grant.schema).flat()))
        
        const componentChildren = this._grants
            .filter((resource) => (resource.component !== undefined))
            .sort(sortOrder)
            .map((resource) => (resource.schema))
            .flat(1)
        
        return {
            data: { tag: 'Asset', uuid: this._universalKey, Story: undefined },
            children: [...globalGrants, ...componentChildren]
        }
    }

    //
    // StandardAuthorizationCollection merge function collects and merges StandardAuthorizationResource
    // entries
    //
    merge(incoming: StandardAuthorizationCollection): StandardAuthorizationCollection {
        // Merge by component reference
        const allComponents = unique(
            this._grants.map((resource) => (resource.component)),
            incoming._grants.map((resource) => (resource.component))
        )
        const newGrants = allComponents
            .map((component) => {
                const baseResource = this._grants.find((resource) => componentEqual(resource.component, component))
                const incomingResource = incoming._grants.find((resource) => componentEqual(resource.component, component))
                if (baseResource && incomingResource) {
                    return baseResource.merge(incomingResource)
                }
                return baseResource ?? incomingResource
            })
            .filter(excludeUndefined)
        return new StandardAuthorizationCollection({ universalKey: this.universalKey, grants: newGrants.map((resource) => (resource.toJSON())) })
    }

    diff(incoming: StandardAuthorizationCollection): StandardAuthorizationCollection {
        // Diff by component reference
        const allComponents = unique(
            this._grants.map((resource) => (resource.component)),
            incoming._grants.map((resource) => (resource.component))
        )
        const newGrants = allComponents
            .map((component) => {
                const baseResource = this._grants.find((resource) => componentEqual(resource.component, component))
                const incomingResource = incoming._grants.find((resource) => componentEqual(resource.component, component))
                if (baseResource && incomingResource) {
                    return baseResource.diff(incomingResource)
                }
                else if (incomingResource) {
                    return incomingResource
                }
                else if (baseResource) {
                    return baseResource.diff(new StandardAuthorizationResource({ component: baseResource.component, grants: [] }))
                }
                return undefined
            })
            .filter(excludeUndefined)
        return new StandardAuthorizationCollection({ universalKey: this.universalKey, grants: newGrants.map((resource) => (resource.toJSON())) })
    }

    renameKey(props: { fromKey: string; toKey: string; }[]): StandardAuthorizationCollection {
        const returnValue = this._clone()
        returnValue._grants = returnValue._grants.map((resource) => {
            for (const { fromKey, toKey } of props) {
                if (resource.component?.key === fromKey) {
                    return new StandardAuthorizationResource({
                        component: resource.component.withKey(toKey),
                        grants: resource.grants
                    })
                }
            }
            return resource
        })
        return returnValue
    }

}
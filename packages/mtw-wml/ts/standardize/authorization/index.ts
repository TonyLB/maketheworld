import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssetUUID, isSchemaAsset, isSchemaAssetUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardAuthorizationItem } from "./components/baseClasses"
import { isStandardAuthorizationCollection, StandardAuthorizationCollectionData } from "./components/dataTypes"
import { isLegalKey } from "../utils"
import StandardReference from "../components/reference"
import { isSchemaTreeNode, nodeFromWML } from "../../schema"
import { ComponentProcessingTemplate } from "../processComponents"
import { excludeUndefined } from "../../lib/lists"
import processAuthorizations from "./processAuthorizations"
import { isStandardAuthorizationResourceNDJSON, StandardAuthorizationResource, StandardAuthorizationResourceNDJSON } from "./resource"
import { StandardBaseData } from "../components/dataTypes/abstract"
import { StandardComponent, StandardToJSONOptions } from "../components/baseClasses"
import { unique } from "../../list"
import { standardComponentByTag } from "../nonEditFactory"
import { deepEqual } from "../../lib/objects"
import { standardComponentSortOrder } from "../sortOrder"

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

export class StandardAuthorizationCollection {
    _universalKey: AssetUUID;
    _grants: StandardAuthorizationResource[];

    constructor(args: StandardAuthorizationCollectionData | GenericTreeNode<SchemaTag> | string | StandardAuthorizationCollectionNDJSON[]) {
        if (typeof args === 'string' && (isLegalKey(args) || args === '')) {
            this._universalKey = args.startsWith('ASSET#') ? args as AssetUUID : `ASSET#${args}`
            this._grants = []
            return
        }
        if (isStandardAuthorizationCollection(args)) {
            this._universalKey = args.key.startsWith('ASSET#') ? args.key as AssetUUID : `ASSET#${args.key}`

            const grantsByReference = args.grants.reduce<Record<string, StandardAuthorizationResource>>((previous, standardResource) => {
                const { referenceStack } = standardResource
                return {
                    ...previous,
                    [referenceStack.map((reference) => ((typeof reference === 'object' && 'key' in reference) ? reference.key : undefined)).filter(excludeUndefined).join('.')]: new StandardAuthorizationResource(standardResource)
                }
            }, {})
            this._grants = Object.values(grantsByReference)
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
                    const matchingIndex = previous.findIndex(([referenceRow]) => (deepEqual(referenceRow.referenceStack, row.referenceStack)))
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

            this._grants = []
            this._universalKey = 'ASSET#'

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                if (!node.data.uuid) {
                    throw new Error('StandardAuthorizationCollection constructor requires a uuid')
                }
                this._universalKey = node.data.uuid

                //
                // Templates for the following component tags: 'Character', 'Image', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action'
                //
                const componentTemplates: ComponentProcessingTemplate[] = [
                    { 
                        key: 'Character',
                        legalParents: ['Room']
                    },
                    { key: 'Image' },
                    {
                        key: 'Room',
                        legalParents: ['Map', 'Message']
                    },
                    {
                        key: 'Feature',
                        legalParents: ['Room']
                    },
                    { key: 'Knowledge' },
                    { key: 'Map' },
                    {
                        key: 'Message',
                        legalParents: ['Moment']
                    },
                    { key: 'Moment' },
                    {
                        key: 'Example',
                        legalParents: ['Room', 'Feature', 'Knowledge']
                    }
                ]
        
                this._grants = Object.values(processAuthorizations({ componentTemplates, schema: node.children }))
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
            const key = resource.referenceStack.map(({ key }) => (key)).join('.')
            if (!key) {
                return previous
            }
            return {
                ...previous,
                [key]: resource
            }
        }, {})
    }
    get global(): StandardAuthorizationResource {
        const globalResource = this._grants.find((resource) => (resource.referenceStack.length === 0))
        if (globalResource) {
            return globalResource
        }
        return new StandardAuthorizationResource({ referenceStack: [], grants: [] })
    }
    get key(): string { return this._universalKey.replace('ASSET#', '') }
    get universalKey(): AssetUUID { return this._universalKey }

    toJSON(options?: StandardToJSONOptions): StandardAuthorizationCollectionData {
        return {
            key: this.key,
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
        const returnValue = new StandardAuthorizationCollection(this.key)
        returnValue._grants = this._grants.map((resource) => (resource.clone()))
        return returnValue
    }

    _sortOrderFactory(): (a: StandardAuthorizationResource, b: StandardAuthorizationResource) => number {
        const sortOrderById = Object.values(this.byId)
            .reduce<Record<string, StandardComponent>>((previous, resource) => {
                const referenceStack = resource.referenceStack
                const key = referenceStack.map(({ key }) => (key)).join('.')
                const lastItem = referenceStack.slice(-1)[0]
                if (!(key && lastItem)) { return previous }
                const defaultComponent = standardComponentByTag(lastItem.tag, key)
                if (!defaultComponent) { return previous }
                return {
                    ...previous,
                    [key]: defaultComponent
                }
            }, {})
        return (a: StandardAuthorizationResource, b: StandardAuthorizationResource) => {
            const aComponent = sortOrderById[a.referenceStack.map(({ key }) => (key)).join('.')]
            const bComponent = sortOrderById[b.referenceStack.map(({ key }) => (key)).join('.')]
            return standardComponentSortOrder(aComponent._key, bComponent._key)
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        //
        // Calculate all keys in the tree of all authorizations that are not global, so that
        // we can create resource references to cover them in later calculation
        //
        const allAuthorizationByIdReferenceStacks = unique(Object.values(this.byId)
            .filter((resource) => (resource.referenceStack.length > 0))
            .map((resource) => (
                resource.referenceStack.map((_, index) => (resource.referenceStack.slice(0, index + 1)))
            )))
            .flat(1)
        //
        // Calculate all keys in the tree of all authorizations that are not global, so that
        // nestedSchema can correctly reference them as it works its way toward the leaves
        // of the tree
        //
        const authorizationsById = allAuthorizationByIdReferenceStacks
            .reduce<Record<string, StandardAuthorizationResource>>((previous, referenceStack) => {
                const key = referenceStack.map(({ key }) => (key)).join('.')
                if (!this.byId[key]) {
                    return {
                        ...previous,
                        [key]: new StandardAuthorizationResource({ referenceStack, grants: [] })
                    }
                }
                return {
                    ...previous,
                    [key]: this.byId[key]
                }
            }, {})
        //
        // Calculate the schema for all global authorizations
        //
        const globalChildren = Object.values(this._grants)
            .filter((resource) => (resource.referenceStack.length === 0))
            .map((resource) => (resource.schema))
            .flat(1)
        //
        // Recursively calculate the schema for all authorizations that are not global
        //
        const sortOrder = this._sortOrderFactory()
        const byIdChildren = Object.values(authorizationsById)
            .filter((resource) => (resource.referenceStack.length === 1))
            .sort(sortOrder)
            //
            // TODO: Pass sortOrderFactory into nestedSchema so that nested entries
            // can also be sorted correctly in schema output
            //
            .map((resource) => (resource.nestedSchema({ authorizationsById, sortOrder })))
            .flat(1)
        return {
            data: { tag: 'Asset', uuid: this._universalKey, Story: undefined },
            children: [...globalChildren, ...byIdChildren]
        }
    }

    //
    // StandardAuthorizationCollection merge function collects and merges StandardAuthorizationResource
    // entries
    //
    merge(incoming: StandardAuthorizationCollection): StandardAuthorizationCollection {
        const allKeys = unique(
            this._grants.map(({ referenceStack }) => (referenceStack.map(({ key }) => (key))).join('.')),
            incoming._grants.map(({ referenceStack }) => (referenceStack.map(({ key }) => (key))).join('.'))
        )
        const newGrants = allKeys
            .reduce<StandardAuthorizationResource[]>((previous, key) => {
                const baseResource = this._grants.find((resource) => (resource.referenceStack.map(({ key }) => (key)).join('.') === key))
                const incomingResource = incoming._grants.find((resource) => (resource.referenceStack.map(({ key }) => (key)).join('.') === key))
                if (baseResource && incomingResource) {
                    return [...previous, baseResource.merge(incomingResource)].filter(excludeUndefined)
                }
                else {
                    return [...previous, baseResource ?? incomingResource].filter(excludeUndefined)
                }
            }, [])
        return new StandardAuthorizationCollection({ key: this.key, grants: newGrants.map((resource) => (resource.toJSON())) })
    }

    diff(incoming: StandardAuthorizationCollection): StandardAuthorizationCollection {
        const allKeys = unique(
            this._grants.map(({ referenceStack }) => (referenceStack.map(({ key }) => (key))).join('.')),
            incoming._grants.map(({ referenceStack }) => (referenceStack.map(({ key }) => (key))).join('.'))
        )
        const newGrants = allKeys
            .reduce<StandardAuthorizationResource[]>((previous, key) => {
                const baseResource = this._grants.find((resource) => (resource.referenceStack.map(({ key }) => (key)).join('.') === key))
                const incomingResource = incoming._grants.find((resource) => (resource.referenceStack.map(({ key }) => (key)).join('.') === key))
                if (baseResource && incomingResource) {
                    return [...previous, baseResource.diff(incomingResource)].filter(excludeUndefined)
                }
                else if (incomingResource) {
                    return [...previous, incomingResource].filter(excludeUndefined)
                }
                else if (baseResource) {
                    return [...previous, baseResource.diff(new StandardAuthorizationResource({ referenceStack: baseResource?.referenceStack, grants: [] }))].filter(excludeUndefined)
                }
                return previous
            }, [])
        return new StandardAuthorizationCollection({ key: this.key, grants: newGrants.map((resource) => (resource.toJSON())) })
    }

    renameKey(props: { fromKey: string; toKey: string; }[]): StandardAuthorizationCollection {
        const returnValue = this._clone()
        returnValue._grants = props.reduce<StandardAuthorizationResource[]>((previous, { fromKey, toKey }) => {
            const fromStack: string[] = fromKey.split('.')
            const toStack: string[] = toKey.split('.')
            if (fromStack.length !== toStack.length) {
                throw new Error('Key mismatch in StandardAuthorizationCollection renameKey')
            }
            return previous.map((resource) => {
                const { referenceStack, grants } = resource
                if (referenceStack.slice(0, fromStack.length).every(({ key }, index) => (key === fromStack[index]))) {
                    return new StandardAuthorizationResource({
                        referenceStack: referenceStack.map((reference, index) => (index < fromStack.length ? reference.withKey(toStack[index]) : reference)),
                        grants
                    })
                }
                else {
                    return resource
                }
            })
        }, returnValue._grants)
        return returnValue
    }

}
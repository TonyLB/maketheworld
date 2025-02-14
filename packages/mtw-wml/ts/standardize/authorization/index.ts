import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isImportable, isSchemaAsset, isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaExport, isSchemaImport, isSchemaMeta } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardAuthorizationItem } from "./components/baseClasses"
import { isStandardAuthorizationCollection, StandardAuthorizationCollectionData } from "./components/dataTypes"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardReference from "../components/reference"
import { isSchemaTreeNode } from "../components/utils"
import { ComponentProcessingTemplate } from "../processComponents"
import { standardAuthorizationFactory } from "./authorizationFactory"
import { excludeUndefined } from "../../lib/lists"
import processAuthorizations from "./processAuthorizations"
import { StandardAuthorizationResource } from "./resource"
import { StandardBaseData } from "../components/dataTypes/abstract"
import { SerializeNDJSONMixin } from "../baseClasses"
import { StandardToJSONOptions } from "../components/baseClasses"
import { standardComponentSortOrder } from ".."
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

export class StandardAuthorizationCollection {
    _key: string;
    _grants: StandardAuthorizationResource[];

    constructor(args: StandardAuthorizationCollectionData | GenericTreeNode<SchemaTag> | string) {
        if (typeof args === 'string' && (isLegalKey(args) || args === '')) {
            this._key = args
            this._grants = []
            return
        }
        if (isStandardAuthorizationCollection(args)) {
            this._key = args.key

            const grantsByReference = args.grants.reduce<Record<string, StandardAuthorizationResource>>((previous, standardResource) => {
                const { referenceStack } = standardResource
                return {
                    ...previous,
                    [referenceStack.map(({ key }) => (key)).join('.')]: new StandardAuthorizationResource(standardResource)
                }
            }, {})
            this._grants = Object.values(grantsByReference)
            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            this._grants = []
            this._key = ''

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                this._key = node.data.key

                //
                // Templates for the following component tags: 'Character', 'Image', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action'
                //
                const componentTemplates: ComponentProcessingTemplate[] = [
                    { key: 'Character' },
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
                    { key: 'Variable' },
                    { key: 'Computed' },
                    { key: 'Action' },
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

    get header(): { tag: 'Asset' } & StandardBaseData & SerializeNDJSONMixin {
        return {
            tag: 'Asset',
            key: this._key,
            universalKey: `ASSET#${this._key}`
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
    get key(): string { return this._key }

    toJSON(options?: StandardToJSONOptions): StandardAuthorizationCollectionData {
        return {
            key: this._key,
            grants: this._grants.map((resource) => (resource.toJSON()))
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const children = Object.values(this._grants)
            //
            // ISS5289: Recursively process in order to allow grants at all levels of
            // a nested hierarchy
            //
            .map((resource) => (resource.schema))
            .flat(1)
        return {
            data: { tag: 'Asset', key: this._key, Story: undefined },
            children
        }
    }

    _clone(): StandardAuthorizationCollection {
        const returnValue = new StandardAuthorizationCollection(this.key)
        returnValue._grants = this._grants.map((resource) => (resource.clone()))
        return returnValue
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
        return new StandardAuthorizationCollection({ key: this._key, grants: newGrants.map((resource) => (resource.toJSON())) })
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
        return new StandardAuthorizationCollection({ key: this._key, grants: newGrants.map((resource) => (resource.toJSON())) })
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
                        referenceStack: referenceStack.map((reference, index) => (index < fromStack.length ? new StandardReference({ ...reference.toJSON(), key: toStack[index] }) : reference)),
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
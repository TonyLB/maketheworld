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
                const { reference, grants } = standardResource
                if (reference) {
                    const key = reference.key
                    return {
                        ...previous,
                        [key]: new StandardAuthorizationResource(standardResource)
                    }
                }
                else {
                    return {
                        ...previous,
                        '': new StandardAuthorizationResource(standardResource)
                    }
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
            const key = resource.referenceStack?.key ?? ''
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
        const globalResource = this._grants.find((resource) => (!resource.referenceStack))
        if (globalResource) {
            return globalResource
        }
        return new StandardAuthorizationResource({ reference: undefined, grants: [] })
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
    // StandardForm merge method accounts for component-level edits (like StandardRemove and StandardReplace)
    // and merges all contents in place
    //
    merge(incoming: StandardForm): StandardForm {
        const allKeys = unique(Object.keys(this._byId), Object.keys(incoming._byId))
        const returnValue = this._clone()
        returnValue._byId = allKeys
            .reduce<Record<string, StandardComponent>>((previous, key) => {
                const baseComponent = this._byId[key]
                const incomingComponent = incoming._byId[key]
                if (baseComponent && incomingComponent) {
                    const mergedComponent = mergeWithEdits(baseComponent, incomingComponent)
                    if (mergedComponent) {
                        return { ...previous, [key]: mergedComponent }
                    } else {
                        const { [key]: _, ...rest } = previous
                        return rest
                    }
                }
                else {
                    return { ...previous, [key]: baseComponent ?? incomingComponent }
                }
            }, {})

        return returnValue
    }

    diff(incoming: StandardForm): StandardForm {
        //
        // Merge the two forms, but only include stub components with the keys and tags in the merged form.
        // This provides a base for standardComponentSortOrder to merge the two key lists in the correct order
        // (without risking the possibility of merge conflicts that are irrelevant at this stage).
        //
        const mergedForKeys = new StandardForm({
            key: this.key,
            byId: [...Object.values(this._byId), ...Object.values(incoming._byId)]
                .filter(excludeUndefined)
                .reduce<Record<string, StandardComponentData>>((previous, component) => {
                    return { ...previous, [component.key]: defaultComponentFromTag(component.tag, component.key) }
                }, {}),
            metaData: []
        })
        //
        // Sort the keys in the merged form by the standardComponentSortOrder, to provide an order in which
        // to diff the components in each StandardForm against each other.
        //
        const allKeys = unique(
            [...Object.values(this._byId), ...Object.values(incoming._byId)]
            .filter(excludeUndefined)
            .sort((a, b) => (standardComponentSortOrder(mergedForKeys._byId)(b, a)))
            .map(({ key }) => (key))
        )
        const returnValue = this._clone()
        returnValue._byId = allKeys
            .reduce<Record<string, StandardComponent>>((previous, key) => {
                const baseComponent = this._byId[key]
                const incomingComponent = incoming._byId[key]
                if (baseComponent && incomingComponent) {
                    const diffedComponent = baseComponent.diff(incomingComponent, { hasDiff: (subKey) => (Boolean(previous[subKey])) })
                    const baseImport = baseComponent.import
                    const incomingImport = incomingComponent.import
                    const diffImport = (baseImport && incomingImport)
                        ? baseImport.diff(incomingImport)
                        : baseImport
                            ? new ImportItemRemove(baseImport.assetId, baseImport.fromKey)
                            : incomingImport
                                ? incomingImport
                                : undefined
                    const baseExport = baseComponent.export
                    const incomingExport = incomingComponent.export
                    const diffExport = (baseExport && incomingExport)
                        ? baseExport.diff(incomingExport)
                        : baseExport
                            ? new ExportItemRemove(baseExport.exportAs)
                            : incomingExport
                                ? incomingExport
                                : undefined
                    if (diffedComponent) {
                        return { ...previous, [key]: diffedComponent.withImport(diffImport).withExport(diffExport) }
                    } else {
                        return previous
                    }
                }
                else {
                    if (baseComponent) {
                        return { ...previous, [key]: new StandardRemove(baseComponent) }
                    }
                    if (incomingComponent) {
                        return { ...previous, [key]: incomingComponent }
                    }
                    throw new Error('diff error')
                }
            }, {})

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }

    renameKey(props: { fromKey: string; toKey: string; retainOldExportAs?: boolean; }[]): StandardForm {
        const returnValue = this._clone()
        const findMatchingRename = (key: string): { fromKey: string; toKey: string; retainOldExportAs?: boolean; } | undefined => {
            const match = props.find(({ fromKey }) => (key.startsWith(fromKey)))
            return match
                ? {
                    fromKey: key,
                    toKey: `${match.toKey}${key.slice(match.fromKey.length)}`,
                    retainOldExportAs: match.retainOldExportAs
                }
                : undefined
        }
        const renameContentsCallback = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
            tree.map((node) => {
                if (treeNodeTypeguard(isSchemaWithKey)(node)) {
                    const match = findMatchingRename(node.data.key)
                    if (match) {
                        return {
                            data: { ...node.data, key: match.toKey },
                            children: renameContentsCallback(node.children)
                        }
                    }
                    return node
                }
                else {
                    if (treeNodeTypeguard(isSchemaExit)(node)) {
                        const matchFrom = findMatchingRename(node.data.from)
                        const matchTo = findMatchingRename(node.data.to)
                        if (matchFrom || matchTo) {
                            return {
                                data: {
                                    ...node.data,
                                    to: matchTo ? matchTo.toKey : node.data.to,
                                    from: matchFrom ? matchFrom.toKey : node.data.from
                                },
                                children: renameContentsCallback(node.children)
                            }
                        }
                    }
                    if (treeNodeTypeguard(isSchemaLink)(node)) {
                        const matchTo = findMatchingRename(node.data.to)
                        if (matchTo) {
                            return {
                                data: {
                                    ...node.data,
                                    to: matchTo.toKey
                                },
                                children: renameContentsCallback(node.children)
                            }
                        }
                    }
                }
                return {
                    ...node,
                    children: renameContentsCallback(node.children)
                }
            })
        )
        returnValue._byId = Object.values(returnValue._byId)
            .reduce<Record<string, StandardComponent>>((previous, component) => {
                const matchKey = findMatchingRename(component.key)
                if (matchKey) {
                    if (previous[matchKey.toKey]) {
                        throw new Error('renameKey collision')
                    }
                    const exportItem = component.export
                        ? (component.export.exportAs === matchKey.toKey) ? undefined: component.export.exportAs
                        : matchKey.retainOldExportAs
                            ? matchKey.fromKey
                            : undefined

                    return {
                        ...previous,
                        [matchKey.toKey]: component
                            .mapContents(renameContentsCallback)
                            .withKey(matchKey.toKey)
                            .withExport(exportItem)
                    }
                }
                if (previous[component.key]) {
                    throw new Error('renameKey collision')
                }
                return {
                    ...previous,
                    [component.key]: component.mapContents(renameContentsCallback)
                }
            }, {})

        return returnValue
    }

}
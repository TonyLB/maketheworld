import { SchemaTag, isSchemaConditionStatement, isSchemaCondition, isSchemaConditionFallthrough, isImportable, SchemaWithKey, isSchemaImport, isSchemaAsset, isSchemaMeta, SchemaAssetTag, isSchemaExport, isSchemaRemove, isSchemaWithKey, isSchemaExit, isSchemaLink } from "../schema/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../tree/baseClasses"
import { isStandardNDJSON, MergeConflictError, SerializeNDJSONMixin, StandardFormSubsetRequest, StandardFormSubsetRequestExit, StandardFormSubsetRequestFull, standardFormSubsetRequestPriority, StandardNDJSON } from "./baseClasses"
import { excludeUndefined } from "../lib/lists"
import { isStandardComponent, isStandardForm, StandardComponentData, StandardComponentNonEditData, StandardFormData } from "./components/dataTypes"
import { unique } from "../list"
import SchemaTagTree from "../tagTree/schema"
import applyEdits from "../schema/treeManipulation/applyEdits"
import StandardRoom, { StandardRoomPayload } from "./components/room"
import StandardFeature, { StandardFeaturePayload } from "./components/feature"
import StandardKnowledge, { StandardKnowledgePayload } from "./components/knowledge"
import StandardMap from "./components/map"
import { isSchemaTreeNode } from "./components/utils"
import { wrappedNodeTypeGuard } from "../schema/utils"
import { HasDescription, HasName, HasShortName } from "./components/abstract"
import { isLegalKey, nodeFromWML, removeNDJSONOnlyProperties } from "./utils"
import { StandardBaseData } from "./components/dataTypes/abstract"
import { StandardComponent } from "./components/component"
import { deepEqual, objectMap } from "../lib/objects"
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace } from "./components/metaData"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { mergeWithEdits, StandardRemove, StandardReplace } from "./edits"
import { standardComponentFactory } from "./componentFactory"
import importExportFromTree from "./importExportFromTree"
import { StandardToJSONOptions } from "./components/baseClasses"

export const assertTypeguard = <T extends any, G extends T>(value: T, typeguard: (value) => value is G): G => {
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

export const defaultSelected = <Extra extends {}>(tree: GenericTree<SchemaTag, Extra>): GenericTree<SchemaTag, Extra> => (
    tree.map((node) => {
        if (treeNodeTypeguard(isSchemaCondition)(node)) {
            const indexOfFirstSelected = node.children.findIndex(({ data }) => ((isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)) && (data.selected ?? false) ))
            if (indexOfFirstSelected !== -1) {
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === indexOfFirstSelected ? true : undefined } }
                            : child
                    )))
                }
            }
            else {
                const fallThroughIndex = node.children.findIndex(treeNodeTypeguard(isSchemaConditionFallthrough))
                return {
                    ...node,
                    children: defaultSelected(node.children.map((child, index) => (
                        treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child)
                            ? { ...child, data: { ...child.data, selected: index === fallThroughIndex } }
                            : child
                    )))
                }
            }
        }
        return {
            ...node,
            children: defaultSelected(node.children)
        }
    })
)

export const hasName = (component: StandardComponent): component is StandardComponent & HasName => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardMap)
}

export const hasDescription = (component: StandardComponent): component is StandardComponent & HasDescription => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge)
}

export const hasShortName = (component: StandardComponent): component is StandardComponent & HasShortName => {
    return (component instanceof StandardRoom)
}

export const standardComponentSortOrder = (componentA: StandardComponent, componentB: StandardComponent): number => {
    const componentKeys: SchemaWithKey["tag"][] = ['Character', 'Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    const tagA = ((componentA instanceof StandardRemove || componentA instanceof StandardReplace)
        ? componentA._match.tag
        : componentA.tag) as SchemaWithKey["tag"]
    const tagB = ((componentB instanceof StandardRemove || componentB instanceof StandardReplace)
        ? componentB._match.tag
        : componentB.tag) as SchemaWithKey["tag"]
    const indexA = componentKeys.indexOf(tagA)
    const indexB = componentKeys.indexOf(tagB)
    if (indexA !== indexB) {
        return indexA - indexB
    }
    else {
        return componentA.key.localeCompare(componentB.key)
    }
}

export class StandardForm {
    _key: string;
    _byId: Record<string, StandardComponent>;
    _metaData: GenericTree<SchemaTag>;

    constructor(args: StandardFormData | GenericTreeNode<SchemaTag> | StandardNDJSON | string) {
        if (typeof args === 'string' && (isLegalKey(args) || args === '')) {
            this._key = args
            this._byId = {}
            this._metaData = []
            return
        }
        if (isStandardForm(args)) {
            this._key = args.key

            const { importItemById, exportItemById } = importExportFromTree(args.metaData)
            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._byId = Object.values(args.byId).reduce<Record<string, StandardComponent>>((previous, standardData) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return {
                        ...previous,
                        [standardItem.key]: standardItem
                            .withImport(importItemById[standardItem.key])
                            .withExport(exportItemById[standardItem.key])
                    }
                }
                else {
                    return previous
                }
            }, {})
            return
        }
        if (isStandardNDJSON(args)) {
            const assetLine = args.find((line: StandardNDJSON[number]): line is { tag: 'Asset' } & StandardBaseData => ('tag' in line && line.tag === 'Asset'))
            if (!assetLine) {
                throw new Error('No asset header found in StandardForm NDJSON input')
            }
            this._key = assetLine.key
            this._byId = args.filter(isStandardComponent).reduce<Record<string, StandardComponent>>((previous, standardData: StandardComponentData & SerializeNDJSONMixin) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return {
                        ...previous,
                        [standardItem.key]: standardItem.withImport(standardData.from).withExport(standardData.exportAs)
                    }
                }
                else {
                    return previous
                }
            }, {})
            this._metaData = []

            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            this._byId = {}
            this._metaData = []

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                const tagTree = new SchemaTagTree([node])
                tagTree._merge = ({ data: dataA }, { data: dataB }) => ({ data: { ...dataA, ...dataB } })
                const assetTree = tagTree.tree
                if (assetTree.length !== 1) {
                    throw new Error('Too many assets in Standarizer')
                }
                const asset = assetTree[0] as GenericTreeNodeFiltered<SchemaAssetTag, SchemaTag>
                this._key = asset.data.key

                this._metaData = [
                    ...tagTree.filter({ match: 'Meta' }).prune({ not: { match: 'Meta' }}).tree
                ]

                //
                // Templates for the following component tags: 'Character', 'Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action'
                //
                const componentTemplates: ComponentProcessingTemplate[] = [
                    { key: 'Character' },
                    { key: 'Image' },
                    { key: 'Bookmark' },
                    { key: 'Room' },
                    {
                        key: 'Feature',
                        legalParents: ['Room']
                    },
                    { key: 'Knowledge' },
                    { key: 'Map' },
                    { key: 'Theme' },
                    { key: 'Message' },
                    { key: 'Moment' },
                    { key: 'Variable' },
                    { key: 'Computed' },
                    { key: 'Action' }
                ]
        
                const { importItemById, exportItemById } = importExportFromTree(asset.children)
                this._byId = processComponents({
                    componentTemplates,
                    tagTree,
                    schema: asset.children,
                    importItemById,
                    exportItemById
                })
                return
            }
        }
        throw new Error('Invalid arguments in StandardForm constructor')
    }

    get metaData(): GenericTree<SchemaTag> {
        const exportContents: GenericTree<SchemaTag> = Object.values(this._byId)
            .filter((component) => (Boolean(component.export)))
            .sort(standardComponentSortOrder)
            .map((component): GenericTreeNode<SchemaTag> => {
                const schema = component.schema
                if (component.export instanceof ExportItemRemove) {
                    return {
                        data: { tag: 'Remove' as const },
                        children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }]
                    }
                }
                if (component.export instanceof ExportItemReplace) {
                    return {
                        data: { tag: 'Replace' as const },
                        children: [
                            { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }] },
                            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { ...schema.data, as: component.export.exportAs } as SchemaTag, children: [] }] }
                        ]
                    }
                }
                if (!(component.export instanceof ExportItemContent)) {
                    throw new Error('Type mismatch in StandardForm metaData')
                }
                return {
                    data: { ...schema.data, as: component.export.exportAs } as SchemaTag,
                    children: []
                }
            })
        const exportItem: GenericTree<SchemaTag> = exportContents.length === 0
            ? []
            : exportContents.every(treeNodeTypeguard(isSchemaRemove))
                ? [{
                    data: { tag: 'Remove' as const },
                    children: [{
                        data: { tag: 'Export' as const, mapping: {} },
                        children: exportContents.map(({ children }) => (children[0]))
                    }]
                }]
                : [{
                    data: { tag: 'Export' as const, mapping: {} },
                    children: exportContents
                }]

        const importsByAssetId: Record<string, GenericTree<SchemaTag>> = Object.values(this._byId)
            .filter((component) => (Boolean(component.import)))
            .sort(standardComponentSortOrder)
            .reduce((previous, component): Record<string, GenericTree<SchemaTag>> => {
                const maybeAddAsKey = (data: SchemaTag, from: string): SchemaTag => {
                    const originalKey = (data as SchemaWithKey).key
                    if (from === originalKey) {
                        return data
                    }
                    else {
                        return {
                            ...data,
                            as: originalKey,
                            key: from
                        } as SchemaWithKey
                    }
                }
                const schema = component.schema
                if (component.import instanceof ImportItemRemove) {
                    return {
                        ...previous,
                        [component.import.assetId]: [
                            ...(previous[component.import.assetId] ?? []),
                            {
                                data: { tag: 'Remove' as const },
                                children: [{ data: maybeAddAsKey(schema.data, component.import.fromKey), children: [] }]
                            }
                        ]
                    }
                }
                if (component.import instanceof ImportItemReplace) {
                    return {
                        ...previous,
                        [component.import.assetId]: [
                            ...(previous[component.import.assetId] ?? []),
                            {
                                data: { tag: 'Replace' as const },
                                children: [
                                    { data: { tag: 'ReplaceMatch' as const }, children: [{ data: maybeAddAsKey(schema.data, component.import.fromKey), children: [] }] },
                                    { data: { tag: 'ReplacePayload' as const }, children: [{ data: maybeAddAsKey(schema.data, component.import._payload.fromKey), children: [] }] }
                                ]
                            }
                        ]
                    }
                }
                if (!component.import) {
                    return previous
                }
                if (!(component.import instanceof ImportItemContent)) {
                    throw new Error('Type mismatch in StandardForm metadata')
                }
                return {
                    ...previous,
                    [component.import.assetId]: [
                        ...(previous[component.import.assetId] ?? []),
                        {
                            data: maybeAddAsKey(schema.data, component.import.fromKey),
                            children: []
                        }
                    ]
                }
            }, {})

        const importItems: GenericTree<SchemaTag> = Object.entries(importsByAssetId)
            .map(([key, importData]) => {
                if (importData.length === 0) {
                    return []
                }
                if (importData.every(treeNodeTypeguard(isSchemaRemove))) {
                    return [{
                        data: { tag: 'Remove' as const },
                        children: [{
                            data: { tag: 'Import' as const, mapping: {}, from: key },
                            children: importData.map(({ children }) => (children[0]))
                        }]
                    }]
                }
                return [{
                    data: { tag: 'Import' as const, mapping: {}, from: key },
                    children: importData
                }]
            })
            .flat(1)
    
        return [
            ...this._metaData,
            ...importItems,
            ...exportItem
        ]
    }
    get header(): { tag: 'Asset' } & StandardBaseData & SerializeNDJSONMixin {
        return {
            tag: 'Asset',
            key: this._key,
            universalKey: `ASSET#${this._key}`
        }
    }

    get byId(): Record<string, StandardComponent> { return this._byId }
    get key(): string { return this._key }

    toJSON(options?: StandardToJSONOptions): StandardFormData {
        return {
            key: this._key,
            metaData: this.metaData,
            byId: Object.values(this._byId).reduce<Record<string, StandardComponentData>>((previous, component) => {
                return {
                    ...previous,
                    [component.key]: component.toJSON(options) as StandardComponentData
                }
            }, {})
        }
    }

    toNDJSON(): StandardNDJSON {
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = Object.values(this._byId)
            .sort(standardComponentSortOrder)
            .map((component) => (component.toNDJSON({
                // from: importById[component.key], exportAs: exportById[component.key]
            })))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const metaData = this.metaData
        const children = Object.values(this._byId)
            .sort(standardComponentSortOrder)
            .map((component) => (component.schema))
        const imports = metaData.filter(wrappedNodeTypeGuard(isSchemaImport))
        const importKeys = unique(imports.map(({ children }) => (children.map(({ data }) => (data)).filter(isImportable).map(({ key, as }) => (as ?? key)))).flat(1))
        return {
            data: { tag: 'Asset', key: this._key, Story: undefined },
            children: [
                ...metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                ...imports,
                //
                // Don't include a separate schema entry for an import that doesn't change the component
                //
                ...children.filter(({ data, children }) => (children.length || !(isImportable(data) && importKeys.includes(data.key)))),
                ...metaData.filter(wrappedNodeTypeGuard(isSchemaExport))
            ]
        }
    }

    _clone(): StandardForm {
        const returnValue = new StandardForm(this.key)
        returnValue._metaData = [...this._metaData]
        returnValue._byId = objectMap(this._byId, (component) => (component.clone()))
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

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }

    subset(requests: StandardFormSubsetRequest[]): StandardForm {
        const returnValue = this._clone()
        returnValue._metaData = [...this._metaData]
        //
        // Starting with all incoming requests as "unchecked", and an empty record of checked requests by Key,
        // loop on:
        //   - updating the checked-requests record with the unchecked requests, and
        //   - in cases where that updates the record, checking the new requests, 
        //   - adding any new keys that are caused by a cascade on checking requests to the "unchecked" bin
        // ... until you run out of new records to check for cascades
        //
        let uncheckedRequests: StandardFormSubsetRequest[] = [...requests]
        let requestTypeByKey: Record<string, StandardFormSubsetRequest> = {}
        while(uncheckedRequests.length) {
            const newRequestTypeByKey = uncheckedRequests.reduce<Record<string, StandardFormSubsetRequest>>((previous, request) => (
                Object.assign(
                    previous,
                    ...request.keys.map((key) => {
                        const priorPriority = Math.min(
                            standardFormSubsetRequestPriority(previous[key]),
                            standardFormSubsetRequestPriority(requestTypeByKey[key])
                        )
                        if (standardFormSubsetRequestPriority(request) < priorPriority) {
                            return { [key]: request }
                        }
                        else {
                            return {}
                        }
                    })
                )
            ), {})
            uncheckedRequests = Object.values(newRequestTypeByKey)
                .filter((request): request is StandardFormSubsetRequestFull | StandardFormSubsetRequestExit => (request.requestType === 'Full' || request.requestType === 'Exit'))
                .filter(({ cascadeConditions }) => ((cascadeConditions ?? []).length))
                .map(({ keys, cascadeConditions }) => {
                    return (cascadeConditions ?? [])
                        .map(({ conditionType, cascadeType, chainCascade }): StandardFormSubsetRequest | undefined => {
                            return {
                                requestType: cascadeType,
                                keys: unique(
                                    keys
                                        .map((key) => (this.byId[key]))
                                        .filter(excludeUndefined)
                                        .map((component) => (
                                            component.referencedKeys()
                                                .filter(({ referenceType }) => (referenceType === conditionType))
                                                .map(({ key }) => (key))
                                        ))
                                        .flat(1)
                                ),
                                cascadeConditions: chainCascade ? cascadeConditions : undefined
                            }
                        })
                        .filter(excludeUndefined)
                })
                .flat(1)
            requestTypeByKey = {
                ...requestTypeByKey,
                ...newRequestTypeByKey
            }
        }

        const requestOutput = (request: StandardFormSubsetRequest, component: StandardComponent) => {
            if (request.requestType === 'Full') {
                return component
            }
            if (request.requestType === 'Stub' || request.requestType === 'ShortName' || request.requestType === 'Exit') {
                const returnValue = component.clone()
                if (returnValue instanceof StandardRoom) {
                    returnValue._payload = new StandardRoomPayload()
                    if ((request.requestType === 'ShortName' || request.requestType === 'Exit') && component instanceof StandardRoom) {
                        returnValue._payload._shortName = component._payload._shortName
                        if (request.requestType === 'Exit') {
                            returnValue._payload._exits = component.exits
                        }
                    }
                }
                if (returnValue instanceof StandardFeature) {
                    returnValue._payload = new StandardFeaturePayload()
                }
                if (returnValue instanceof StandardKnowledge) {
                    returnValue._payload = new StandardKnowledgePayload()
                }
                return returnValue
            }
        }

        returnValue._byId = Object.assign({},
            ...(Object.entries(requestTypeByKey)
                .map(([key, request]) => (
                    this.byId[key]
                        ? [{ [key]: requestOutput(request, this.byId[key]) }]
                        : []
                ))
                .flat(1)
            )
        )

        return returnValue
    }

    renameKey(props: { fromKey: string; toKey: string; retainOldExportAs?: boolean; }[]): StandardForm {
        const returnValue = this._clone()
        const findMatchingRename = (key: string): { fromKey: string; toKey: string; retainOldExportAs?: boolean; } | undefined => {
            return props.find(({ fromKey }) => (fromKey === key))
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
                    return {
                        ...previous,
                        [matchKey.toKey]: component
                            .mapContents(renameContentsCallback)
                            .withKey(matchKey.toKey)
                            .withExport(
                                component.export
                                    ? (component.export.exportAs === matchKey.toKey) ? undefined: component.export.exportAs
                                    : matchKey.retainOldExportAs
                                        ? matchKey.fromKey
                                        : undefined
                            )
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

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardForm {
        const returnValue = this._clone()
        returnValue._byId = objectMap(returnValue.byId, (component) => (component.mapContents(callback)))
        return returnValue
    }

    withUpdatedUniversalKeys(callback: (key: string) => string | undefined): StandardForm {
        const returnValue = this._clone()
        returnValue._byId = objectMap(returnValue.byId, (component) => {
            const updatedUniversalKey = callback(component.key)
            if (updatedUniversalKey && !(component.universalKey === updatedUniversalKey)) {
                return component.withUniversalKey(updatedUniversalKey)
            }
            return component
        })
        return returnValue
    }

}
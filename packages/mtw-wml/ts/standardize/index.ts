import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { defaultComponentFromTag, isStandardNDJSON, SerializeNDJSONMixin, StandardComponentData, StandardFormSubsetRequest, StandardFormSubsetRequestExit, StandardFormSubsetRequestFull, standardFormSubsetRequestMatch, standardFormSubsetRequestPriority, StandardNDJSON } from "./baseClasses"
import { excludeUndefined } from "../lib/lists"
import { isStandardComponent, isStandardForm, StandardFormData } from "./components/dataTypes"
import { unique } from "../list"
import SchemaTagTree from "../tagTree/schema"
import applyEdits from "../schema/treeManipulation/applyEdits"
import StandardRoom, { StandardRoomPayload } from "./components/room"
import StandardFeature, { StandardFeaturePayload } from "./components/feature"
import StandardKnowledge, { StandardKnowledgePayload } from "./components/knowledge"
import StandardMap from "./components/map"
import { wrappedNodeTypeGuard } from "../schema/utils"
import { HasDescription, HasName, HasShortName } from "./components/abstract"
import { isLegalKey } from "./utils"
import { StandardBaseData } from "./components/dataTypes/abstract"
import { StandardComponent } from "./components/baseClasses"
import { objectMap } from "../lib/objects"
import { ExportItemContent, ExportItemRemove, ExportItemReplace, ImportItemContent, ImportItemRemove, ImportItemReplace } from "./components/metaData"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { StandardRemove } from "./components/edits"
import { standardComponentFactory } from "./componentFactory"
import importExportFromTree from "./importExportFromTree"
import { StandardToJSONOptions } from "./components/baseClasses"
import { ComponentUUID, isImportable, isSchemaAsset, isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { isSchemaExport, isSchemaImport, isSchemaMeta } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode, nodeFromWML } from "../schema"
import { mergeToComponentList, mergeUniversalKeyMappings } from "./mergeToComponentList"
import { StandardReferenceData } from "./components/dataTypes/reference"
import { uniqueReferences } from "./components/utils/references"
import StandardReference, { StandardKey, StandardReferenceSimple } from "./components/reference"
import { standardComponentSortOrder } from "./sortOrder"
import { UUIDGenerator } from "@tonylb/mtw-utilities/ts/uuid/index"

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

export const defaultSelected = <Extra extends {}>(tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
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
    return (component instanceof StandardRoom) ||
        (component instanceof StandardCharacter)
}

const lookupInComponentList = (componentList: StandardComponent[], key: StandardKey): StandardComponent | undefined => {
    if (typeof key === 'string') {
        return componentList.find((component) => (component.universalKey === key))
    }
    return componentList.find((component) => (
        (component.key && component.key === key.key) ||
        (component.universalKey && component.universalKey === key.universalKey)
    ))
}


export class StandardForm {
    _key?: string;
    _components: StandardComponent[];
    _byId: Record<string, StandardComponent>;
    _metaData: GenericTree<SchemaTag>;

    constructor(args: StandardFormData | GenericTreeNode<SchemaTag> | StandardNDJSON | string) {
        if (typeof args === 'string' && (isLegalKey(args) || args === '')) {
            this._key = args
            this._byId = {}
            this._components = []
            this._metaData = []
            return
        }
        if (isStandardForm(args)) {
            this._key = args.key

            const { importItemById, exportItemById } = importExportFromTree(args.metaData)
            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._components = args.components.reduce<StandardComponent[]>((previous, standardData) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return [
                        ...previous,
                        standardItem
                            .withImport(importItemById[standardItem.key ?? ''])
                            .withExport(exportItemById[standardItem.key ?? ''])
                    ]
                }
                else {
                    return previous
                }
            }, [])
            this._byId = this._components
                .reduce<Record<string, StandardComponent>>((previous, component) => {
                    return {
                        ...previous,
                        [component.key ?? '']: component
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
            this._components = args.filter(isStandardComponent).reduce<StandardComponent[]>((previous, standardData: StandardComponentData & SerializeNDJSONMixin) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return [
                        ...previous,
                        standardItem
                            .withImport(standardData.from)
                            .withExport(standardData.exportAs)
                    ]
                }
                else {
                    return previous
                }
            }, [])
            this._byId = this._components
                .reduce<Record<string, StandardComponent>>((previous, component) => {
                    return {
                        ...previous,
                        [component.key ?? '']: component
                    }
                }, {})

            this._metaData = []

            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                this._key = node.data.key

                this._metaData = node.children.filter(wrappedNodeTypeGuard(isSchemaMeta))

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

                const componentFragments = processComponents({ componentTemplates, schema: node.children })
                const universalKeyMappings: StandardKey[] = componentFragments
                    .reduce<StandardKey[]>((previous, component) => {
                        const previousMatchIndex = previous.findIndex(({ key, universalKey }) => (
                            (key && key === component.key) ||
                            (universalKey && universalKey === component.universalKey)
                        ))
                        if (previousMatchIndex === -1) {
                            return [...previous, new StandardKey(component._key)]
                        }
                        const previousMatch = previous[previousMatchIndex]
                        if (previousMatch && (
                            (previousMatch.key && component.key && previousMatch.key !== component.key) ||
                            (previousMatch.universalKey && component.universalKey && previousMatch.universalKey !== component.universalKey))) {
                            throw new Error(`Key / UniversalKey mismatch in StandardForm constructor (${component.key} / ${component.universalKey})`)
                        }
                        return [
                            ...previous.slice(0, previousMatchIndex),
                            new StandardKey({
                                universalKey: previousMatch.universalKey ?? component.universalKey,
                                key: previousMatch.key ?? component.key,
                                tag: previousMatch.tag ?? component.tag
                            }),
                            ...previous.slice(previousMatchIndex + 1)
                        ]
                    }, [])
                    .filter(({ key, universalKey }) => (key || universalKey))
                this._components = componentFragments.reduce<StandardComponent[]>(mergeToComponentList(universalKeyMappings), [])
                this._byId = this._components
                    .reduce<Record<string, StandardComponent>>((previous, component) => {
                        return {
                            ...previous,
                            [component.key ?? '']: component
                        }
                    }, {})
                return
            }
            else {
                this._metaData = []
                this._components = []
                this._byId = {}
            }
        }
        console.log(`Invalid arguments: ${JSON.stringify(args, null, 4)}`)
        throw new Error('Invalid arguments in StandardForm constructor')
    }

    get metaData(): GenericTree<SchemaTag> {
        const exportContents: GenericTree<SchemaTag> = this._components
            .filter((component) => (Boolean(component.export)))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
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
                            { data: { tag: 'ReplacePayload' as const }, children: [{ data: { ...schema.data, as: component.export._payload } as SchemaTag, children: [] }] }
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
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
            .reduce<Record<string, GenericTree<SchemaTag>>>((previous, component): Record<string, GenericTree<SchemaTag>> => {
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

    get byId(): Record<string, StandardComponent> {
        const returnProxy = new Proxy(this._components, {
            get: (target, prop: string) => {
                const findComponent = target.find((component) => (component.key === prop))
                if (findComponent) {
                    return findComponent
                }
                return undefined
            },
            has(target, prop: string): boolean {
                const findComponent = target.find((component) => (component.key === prop))
                if (findComponent) {
                    return true
                }
                return false
            },
            set: (target, prop: string, value: StandardComponent): boolean => {
                if (isStandardComponent(value)) {
                    const findComponentIndex = target.findIndex((component) => (component.key === prop))
                    if (findComponentIndex === -1) {
                        target.push(value)
                    }
                    else {
                        target = [
                            ...target.slice(0, findComponentIndex),
                            value,
                            ...target.slice(findComponentIndex + 1)
                        ]
                    }
                    return true
                }
                throw new Error('Invalid value in StandardForm byId setter')
            }

        })
        return returnProxy as unknown as Record<string, StandardComponent>
    }
    get key(): string { return this._key ?? '' }

    toJSON(options?: StandardToJSONOptions): StandardFormData {
        return {
            key: this._key,
            metaData: this.metaData,
            components: this._components.map((component) => (component.toJSON(options) as StandardComponentData))
        }
    }

    toNDJSON(): StandardNDJSON {
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = this._components
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
            .map((component) => (component.toJSON()))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const metaData = this.metaData
        console.log(`Sorted top level schema: ${JSON.stringify(this._components
            .filter(({ leastCommonContext }) => ((leastCommonContext ?? []).length === 0))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
            .map((component => (component._key.toJSON()))), null, 4
        )}`)
        const children = this._components
            .filter(({ leastCommonContext }) => ((leastCommonContext ?? []).length === 0))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
            .map((component) => (component.nestedSchema(this._lookup.bind(this), { context: [] })))
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
        returnValue._components = this._components.map((component) => (component.clone()))
        return returnValue
    }

    get _keys(): StandardKey[] {
        return this._components
            .map((component) => (component._key))
    }

    _lookup(reference: StandardReferenceData): StandardComponent | undefined {
        return lookupInComponentList(this._components, new StandardKey(reference))
    }

    //
    // StandardForm merge method accounts for component-level edits (like StandardRemove and StandardReplace)
    // and merges all contents in place
    //
    merge(incoming: StandardForm): StandardForm {
        const mergedUniversalKeyMappings = mergeUniversalKeyMappings([...this._keys, ...incoming._keys])
        const returnValue = this._clone()
        returnValue._components = [...this._clone()._components, ...incoming._clone()._components].reduce(mergeToComponentList(mergedUniversalKeyMappings), [])

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }

    diff(incoming: StandardForm): StandardForm {
        //
        // Merge the two forms, but only include stub components with the keys and tags in the merged form.
        // This provides a base for standardComponentSortOrder to merge the two key lists in the correct order
        // (without risking the possibility of merge conflicts that are irrelevant at this stage).
        //
        console.log(`diff base: ${JSON.stringify(this.toJSON(), null, 4)}`)
        console.log(`diff incoming: ${JSON.stringify(incoming.toJSON(), null, 4)}`)
        const mergedForKeys = new StandardForm({
            key: this.key,
            components: [...this._components, ...incoming._components]
                .map((component) => (defaultComponentFromTag(component.tag, component.key, component.universalKey))),
            metaData: []
        })
        //
        // Sort the keys in the merged form by the standardComponentSortOrder, to provide an order in which
        // to diff the components in each StandardForm against each other.
        //
        const allKeys = uniqueReferences(
            [...this._components, ...incoming._components]
            .map((component) => (new StandardReference(component.referenceData)))
        ).map((reference) => (reference._payload.plain.toJSON()))
        const returnValue = this._clone()
        //
        // TODO: It is important that all of the keys be sorted in *reverse* standardComponentSortOrder,
        // so that when you come to (for instance) a parent room with child features and examples,
        // those children would *already* have been diffed and be in the `previous` variable of the
        // reduce. That, in turn, powers the `hasDiff` function in the options of the diff method,
        // to make sure that the relevant parent components are provided as context for the structure
        // of the diff StandardForm.
        //
        // The problem with this (at the moment) is that the standardComponentSortOrder function is
        // deeply entangled with the way that parent-child information is encoded in the string structure
        // of keys. Long-term, we want to disentangle that. Short-term, we should get a fix that works
        // in cases where the keys are organized as they are, in order to get back to a more stable state.
        //
        returnValue._components = allKeys
            .sort((a, b) => {
                const lookupA = mergedForKeys._lookup(a)
                const lookupB = mergedForKeys._lookup(b)
                if (lookupA && lookupB) {
                    return standardComponentSortOrder(lookupB._key, lookupA._key)
                }
                else {
                    return 0
                }
            })
            .reduce<StandardComponent[]>((previous, reference) => {
                const baseComponent = this._lookup(reference)
                const incomingComponent = incoming._lookup(reference)
                if (baseComponent && incomingComponent) {
                    console.log(`bothMatch: ${JSON.stringify(reference, null, 4)}`)
                    const diffedComponent = baseComponent.diff(incomingComponent, { hasDiff: (subKey) => (Boolean(previous.find(({ key }) => (key === subKey)))) })
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
                        return mergeToComponentList(mergedForKeys._keys)(
                            previous,
                            diffedComponent.withImport(diffImport).withExport(diffExport)
                        )
                    } else {
                        return previous
                    }
                }
                else {
                    if (baseComponent) {
                        return mergeToComponentList(mergedForKeys._keys)(
                            previous,
                            new StandardRemove(baseComponent)
                        )
                    }
                    if (incomingComponent) {
                        return mergeToComponentList(mergedForKeys._keys)(
                            previous,
                            incomingComponent
                        )
                    }
                    throw new Error('diff error')
                }
            }, [])

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        return returnValue
    }

    subset(requests: StandardFormSubsetRequest[]): StandardForm {
        const returnValue = this._clone()
        returnValue._metaData = [...this._metaData]
        //
        // mergeIntoRequestList is a reducer that takes a current list of request, and a new request that should
        // be merged into the list. For each key in the new request, it checks if there is a prior request
        // for that key, and if so, whether the new request has a higher priority than the prior request.
        // If so, it updates the prior request by removing that key (it will no longer be processed at the
        // lower priority request type) and adding the new request type for that key at the appropriate type,
        // either adding it to the keys list of an existing request, or creating a new request. If removing
        // a key from a prior request would leave it with no keys, then that request is removed from the list.
        //
        const mergeIntoRequestList = (previous: StandardFormSubsetRequest[], request: StandardFormSubsetRequest): StandardFormSubsetRequest[] => {
            const updatedToAddEmptyRequestTypeRecordIfNeeded = previous.find(standardFormSubsetRequestMatch(request))
                ? previous
                : [
                    ...previous,
                    {
                        ...request,
                        keys: []
                    }
                ]
            //
            // A local helper function to add a single key to the request list at the requested type
            //
            const addKeyToRequest = (match: StandardFormSubsetRequest) => (requestList: StandardFormSubsetRequest[], key: StandardKey): StandardFormSubsetRequest[] => {
                const index = requestList.findIndex(standardFormSubsetRequestMatch(match))
                if (index === -1) {
                    return [
                        ...requestList,
                        {
                            ...match,
                            keys: [key]
                        }
                    ]
                }
                return requestList.map((item, i) => {
                    if (i === index) {
                        return {
                            ...item,
                            keys: [...item.keys.filter((checkKey) => (!key.equals(checkKey))), key]
                        }
                    }
                    return item
                })
            }

            //
            // Update key lists to remove lower priority previous request
            //
            return request.keys.reduce<StandardFormSubsetRequest[]>((accumulator, key) => {
                const priorRequestByKey = accumulator.find(({ keys }) => (keys.some((checkKey) => (key.equals(checkKey)))))
                if (priorRequestByKey) {
                    const priorPriority = standardFormSubsetRequestPriority(priorRequestByKey)
                    if (standardFormSubsetRequestPriority(request) < priorPriority) {
                        //
                        // If the new request has a higher priority than the prior request, then remove the key
                        // from the prior request and add the new request type for that key.
                        //
                        const trimmedAccumulator = accumulator.map((prior) => {
                            if (prior === priorRequestByKey) {
                                const newKeys = prior.keys.filter((checkKey) => (!key.equals(checkKey)))
                                return {
                                    ...prior,
                                    keys: newKeys
                                }
                            }
                            return prior
                        }).filter(({ keys }) => (keys.length > 0))
                        return addKeyToRequest(request)(trimmedAccumulator, key)
                    }
                }
                return addKeyToRequest(request)(accumulator, key)
            }, updatedToAddEmptyRequestTypeRecordIfNeeded)

        }

        //
        // cascadeRequests is a recursive function that takes a list of new requests, and a list of *prior* requests,
        // and in the context of this StandardForm, determines the full and complete list of requests (including any
        // that are created by cascading conditions). At each step, it checks for cascades generated by the new requests,
        // and creates a cascadeList, then compares that cascadeList against the merger of the prior requests and the new requests.
        // If there are any new requests in the cascadeList that are not already in the merged requests, then it recursively calls
        // itself with the cascadeList as the new requests, and the merged requests as the prior requests.
        //
        const cascadeRequests = (newRequests: StandardFormSubsetRequest[], priorRequests: StandardFormSubsetRequest[] = []): StandardFormSubsetRequest[] => {
            const mergedRequests = newRequests.reduce(mergeIntoRequestList, priorRequests)
            const cascadeList = newRequests.reduce<StandardFormSubsetRequest[]>((previous, request) => {
                if (request.requestType !== 'Full' && request.requestType !== 'Exit') {
                    return previous
                }
                const cascadeFunction: (referenceKey: StandardKey) => StandardFormSubsetRequest[] = (key) => ([
                    ...([this._lookup(key)]
                        .filter(excludeUndefined)
                        .map((component) => (
                            component.referencedKeys().map(({ key, referenceType }) => {
                                if (request.requestType === 'Full') {
                                    if (referenceType === 'Direct') {
                                        return {
                                            requestType: 'Full' as const,
                                            keys: [key],
                                            cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                        }
                                    }
                                    if (referenceType === 'Position') {
                                        return {
                                            requestType: 'ShortName' as const,
                                            keys: [key],
                                            cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                        }
                                    }
                                }
                                return {
                                    requestType: 'Stub' as const,
                                    keys: [key],
                                    cascadeConditions: request.cascadeConditions?.filter(({ chainCascade }) => (chainCascade))
                                }
                            })
                        ))
                        .flat(1)
                    ),
                    ...(request.cascadeConditions && request.cascadeConditions.length)
                        ? request.cascadeConditions?.map(({ conditionType, cascadeType, chainCascade }) => {
                            const returnValue = {
                                requestType: cascadeType,
                                keys: [this._lookup(key)]
                                    .filter(excludeUndefined)
                                    .map((component) => (
                                        component.referencedKeys()
                                            .filter(({ referenceType }) => (referenceType === conditionType))
                                            .map(({ key }) => (key))
                                    ))
                                    .flat(1),
                                cascadeConditions: chainCascade ? request.cascadeConditions : undefined
                            }
                            if (returnValue.keys.length === 0) {
                                return []
                            }
                            return returnValue
                        }).flat(1).filter(excludeUndefined) ?? []
                        : []
                ])
                return request.keys.map(cascadeFunction)
                    .flat(1)
                    .map((request) => ({
                        ...request,
                        keys: request.keys.map(this._lookup.bind(this))
                            .filter(excludeUndefined)
                            .map(({ _key }) => (_key))
                    }))
                    .reduce(mergeIntoRequestList, [])
            }, [])
            if (cascadeList.length === 0) {
                return mergedRequests
            }
            const newCascadeList = cascadeList.filter((request) => (!mergedRequests.find((checkRequest) => (
                standardFormSubsetRequestMatch(request) &&
                (!request.keys.some((key) => (!checkRequest.keys.some((checkKey) => (key.equals(checkKey))))))
            ))))
            if (newCascadeList.length === 0) {
                return mergedRequests
            }
            return cascadeRequests(newCascadeList, mergedRequests)
        }

        const allRequests = cascadeRequests(requests)
        const requestOutput = (request: StandardFormSubsetRequest, component: StandardComponent): StandardComponent[] => {
            if (request.requestType === 'Full') {
                return [component]
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
                return [returnValue]
            }
            return []
        }

        returnValue._components = allRequests
            .reduce<StandardComponent[]>((previous, request) => {
                return request.keys.reduce<StandardComponent[]>((accumulator, key) => {
                    const component = lookupInComponentList(this._components, key)
                    if (!component) {
                        return accumulator
                    }
                    return requestOutput(request, component).reduce<StandardComponent[]>((innerAccumulator, output) => (mergeToComponentList(returnValue._keys)(innerAccumulator, output)), accumulator)
                }, previous)
            }, [])

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
                    const match = findMatchingRename(node.data.key ?? '')
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
                const matchKey = findMatchingRename(component.key ?? '')
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
                if (previous[component.key ?? '']) {
                    throw new Error('renameKey collision')
                }
                return {
                    ...previous,
                    [component.key ?? '']: component.mapContents(renameContentsCallback)
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
            const updatedUniversalKey = callback(component.key ?? '')
            if (updatedUniversalKey && !(component.universalKey === updatedUniversalKey)) {
                return component.withUniversalKey(updatedUniversalKey)
            }
            return component
        })
        return returnValue
    }

    finalize(): StandardForm {
        const returnValue = this._clone()
        const uuidGenerator = new UUIDGenerator()
        const uuidDefaultedComponents = returnValue._components
            .map((component) => {
                if (!component.universalKey) {
                    return component.withUniversalKey(uuidGenerator.next())
                }
                return component
            })
        const rebuiltContextComponents = uuidDefaultedComponents
            .sort(({ leastCommonContext: contextA }, { leastCommonContext: contextB }) => ((contextA ?? []).length - (contextB ?? []).length))
            .reduce<StandardComponent[]>((previous, component) => {
                if (component.leastCommonContext && component.leastCommonContext.length > 0) {
                    const directParentKey = component.leastCommonContext.slice(-1)[0]
                    const directParent = lookupInComponentList(previous, new StandardKey(directParentKey))
                    if (directParent) {
                        const newContext = [...(directParent.leastCommonContext ?? []), new StandardReferenceSimple(directParent._key)]
                        return [...previous, component.withLeastCommonContext(newContext)]
                    }
                }
                return [...previous, component]
            }, [])
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
        returnValue._components = rebuiltContextComponents
        return returnValue
    }

}
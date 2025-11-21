import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { defaultComponentFromTag, isStandardNDJSON, SerializeNDJSONMixin, StandardComponentData, StandardFormSemanticMode, StandardFormSubsetRequest, StandardFormSubsetCascadeCondition, standardFormSubsetRequestMatch, standardFormSubsetRequestPriority, StandardNDJSON } from "./baseClasses"
import { isStandardComponentData, isStandardForm, StandardFormData } from "./components/dataTypes"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
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
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { StandardRemove, StandardReplace } from "./components/edits"
import { standardComponentFactory } from "./componentFactory"
import { StandardToJSONOptions } from "./components/baseClasses"
import { AssetUUID, ComponentUUID, isSchemaAsset, isSchemaAssetUUID, isSchemaOutputTag, isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport, isSchemaMeta } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaExit, isSchemaShortName } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaSummary } from "@tonylb/mtw-base/ts/schema/example"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode, nodeFromWML } from "../schema"
import { mergeToComponentList, mergeUniversalKeyMappings } from "./mergeToComponentList"
import { StandardReferenceData } from "./components/dataTypes/reference"
import StandardReference, { ReferenceList, StandardKey } from "./components/reference"
import { standardComponentSortOrder } from "./sortOrder"
import { UUIDGenerator } from "@tonylb/mtw-utilities/ts/uuid/index"
import StandardImage from "./components/image"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardExample from "./components/example"
import { StandardLiteral } from "./literal"
import { StandardRender } from "./render"
import { excludeUndefined } from "../lib/lists"
import { rebuildSchemaFromStandardRender } from "./components/utils/extractStandardRender"
import { Graph } from "@tonylb/mtw-utilities/ts/graphStorage/utils/graph"

export const isStandardComponent = (value: any): value is StandardComponent => {
    return (value instanceof StandardRemove) ||
        (value instanceof StandardReplace) ||
        (value instanceof StandardCharacter) ||
        (value instanceof StandardFeature) ||
        (value instanceof StandardImage) ||
        (value instanceof StandardKnowledge) ||
        (value instanceof StandardMap) ||
        (value instanceof StandardMessage) ||
        (value instanceof StandardMoment) ||
        (value instanceof StandardRoom) ||
        (value instanceof StandardExample)
}

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



export const hasName = (component: StandardComponent): component is StandardComponent & HasName => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardMap)
}

export const hasDescription = (component: StandardComponent): component is StandardComponent & HasDescription => {
    return (component instanceof StandardRoom || component instanceof StandardFeature || component instanceof StandardKnowledge)
}

export const hasShortName = (component: StandardComponent): component is StandardComponent & HasShortName => {
    return (component instanceof StandardRoom) ||
        (component instanceof StandardCharacter) ||
        (component instanceof StandardFeature) ||
        (component instanceof StandardKnowledge)
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
    _universalKey: AssetUUID;
    _components: StandardComponent[];
    _metaData: GenericTree<SchemaTag>;
    _shortName?: StandardLiteral;
    _summary?: StandardRender;
    /**
     * Optional semantic mode indicating how this StandardForm should be interpreted and used.
     * 
     * @see {@link ./AGENT.md#semantic-modes AGENT.md - Semantic Modes} for detailed explanation of each mode
     */
    semanticMode?: StandardFormSemanticMode;

    constructor(args: StandardFormData | GenericTreeNode<SchemaTag> | StandardNDJSON | string) {
        if (typeof args === 'string' && isSchemaAssetUUID(args)) {
            this._universalKey = args
            this._components = []
            this._metaData = []
            return
        }
        if (isStandardForm(args)) {
            this._universalKey = args.universalKey

            this._metaData = args.metaData.filter((node) => (!wrappedNodeTypeGuard(isSchemaImport)(node)))
            this._components = args.components.reduce<StandardComponent[]>((previous, standardData) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    return [
                        ...previous,
                        standardItem
                    ]
                }
                else {
                    return previous
                }
            }, [])
            // Extract Asset-level metadata from StandardFormData
            this._shortName = args.shortName ? new StandardLiteral(args.shortName) : undefined
            this._summary = args.summary ? new StandardRender(args.summary) : undefined
            return
        }
        if (isStandardNDJSON(args)) {
            const assetLine = args.find((line: StandardNDJSON[number]): line is { tag: 'Asset' } & StandardBaseData => ('tag' in line && line.tag === 'Asset'))
            if (!assetLine) {
                throw new Error('No asset header found in StandardForm NDJSON input')
            }
            if (!assetLine.universalKey || !isSchemaAssetUUID(assetLine.universalKey)) {
                throw new Error('Asset universalKey is required in NDJSON')
            }
            this._universalKey = assetLine.universalKey
            
            // Extract Asset-level metadata from NDJSON header
            this._shortName = (assetLine as any).shortName ? new StandardLiteral((assetLine as any).shortName) : undefined
            this._summary = (assetLine as any).summary ? new StandardRender((assetLine as any).summary) : undefined
            
            this._components = args.filter(isStandardComponentData).reduce<StandardComponent[]>((previous, standardData: StandardComponentData & SerializeNDJSONMixin) => {
                const standardItem = standardComponentFactory(standardData)
                if (standardItem) {
                    standardItem._from = standardData.from
                    return [...previous, standardItem]
                }
                else {
                    return previous
                }
            }, [])

            this._metaData = []

            return
        }
        if (isSchemaTreeNode(args) || typeof args === 'string') {
            const node = typeof args === 'string'
                ? nodeFromWML(args)
                : args

            if (treeNodeTypeguard(isSchemaAsset)(node)) {
                this._universalKey = node.data.uuid

                this._metaData = node.children.filter(wrappedNodeTypeGuard(isSchemaMeta))

                //
                // Extract ShortName and Summary from Asset children
                //
                const tagTree = new SchemaTagTree(node.children)
                const shortNameItem = tagTree
                    .filter({ and: [{ match: 'ShortName' }, { not: { or: [{ match: 'Room' }, { match: 'Feature' }, { match: 'Character' }, { match: 'Knowledge' }] } }] })
                    .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                    .tree
                const summaryItem = tagTree
                    .filter({ and: [{ match: 'Summary' }, { not: { match: 'Example' } }] })
                    .prune({ match: 'Summary' })
                    .tree
                    .filter(wrappedNodeTypeGuard(isSchemaOutputTag))
                this._shortName = shortNameItem.length ? new StandardLiteral(shortNameItem) : undefined
                this._summary = summaryItem.length ? new StandardRender(summaryItem) : undefined

                //
                // Templates for the following component tags: 'Character', 'Image', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Example'
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
                        legalParents: ['Room', 'Feature', 'Knowledge', 'Asset']
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
                this._components = componentFragments
                    .reduce<StandardComponent[]>(mergeToComponentList(universalKeyMappings), [])
                    .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
                return
            }
            else {
                this._metaData = []
                this._components = []
            }
        }
        console.log(`Invalid arguments: ${JSON.stringify(args, null, 4)}`)
        throw new Error('Invalid arguments in StandardForm constructor')
    }

    /**
     * Returns true when the StandardForm contains no meaningful content.
     * Meaningful content includes any components, or Asset-level ShortName/Summary.
     * Imports and empty metadata do not count as content.
     */
    isEmpty(): boolean {
        const hasComponents = this._components.length > 0
        const hasShortName = Boolean(this._shortName)
        const hasSummary = Boolean(this._summary)
        return !(hasComponents || hasShortName || hasSummary)
    }

    get metaData(): GenericTree<SchemaTag> {
        return [...this._metaData]
    }

    get shortName(): StandardLiteral | undefined {
        return this._shortName
    }

    get summary(): StandardRender | undefined {
        return this._summary
    }

    get header(): { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree> } & StandardBaseData & SerializeNDJSONMixin {
        const header: { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree> } & StandardBaseData & SerializeNDJSONMixin = {
            tag: 'Asset',
            universalKey: this._universalKey
        }
        // Include Asset-level metadata in NDJSON header (following omission-over-empty principle)
        if (this._shortName) {
            header.shortName = this._shortName.toJSON()
        }
        if (this._summary) {
            header.summary = this._summary.toJSON()
        }
        return header
    }

    get byId(): Record<string, StandardComponent> {
        const returnProxy = new Proxy(this, {
            get: (target, prop: string) => {
                const findComponent = target._components.find((component) => (component.key === prop))
                if (findComponent) {
                    return findComponent
                }
                return undefined
            },
            has(target, prop: string): boolean {
                const findComponent = target._components.find((component) => (component.key === prop))
                if (findComponent) {
                    return true
                }
                return false
            },
            set: (target, prop: string, value: StandardComponent): boolean => {
                if (isStandardComponent(value)) {
                    const findComponentIndex = target._components.findIndex((component) => (component.key === prop))
                    if (findComponentIndex === -1) {
                        target._components.push(value)
                    }
                    else {
                        target._components = [
                            ...target._components.slice(0, findComponentIndex),
                            value,
                            ...target._components.slice(findComponentIndex + 1)
                        ]
                    }
                    return true
                }
                throw new Error('Invalid value in StandardForm byId setter')
            }

        })
        return returnProxy as unknown as Record<string, StandardComponent>
    }

    /**
     * Computes parent→child edges from all components in this StandardForm.
     * 
     * **Requires universalKey assignment**: This method relies on all components having
     * `universalKey` values assigned. When called from within `finalize()`, this should
     * be after the key-remapping step that assigns universalKeys to components that don't
     * have them. Without universalKeys, components cannot be uniquely identified for edge
     * construction.
     * 
     * Edges are computed on-demand from component.referencedKeys() filtered for
     * 'Direct' or 'Position' reference types (which represent parent-child relationships).
     * 
     * @returns Array of parent→child edge pairs, where each edge is represented as
     *          `{ parent: ComponentUUID, child: ComponentUUID }`
     */
    _getParentChildEdges(): Array<{ parent: ComponentUUID; child: ComponentUUID }> {
        const edges: Array<{ parent: ComponentUUID; child: ComponentUUID }> = []
        
        for (const component of this._components) {
            // Skip components without universalKey (can't create edges without identifiers)
            if (!component.universalKey) {
                continue
            }
            
            const parentUUID: ComponentUUID = component.universalKey
            
            // Get all referenced keys from this component
            const referencedKeys = component.referencedKeys()
            
            // Filter for 'Direct' or 'Position' reference types (parent-child relationships)
            const childReferences = referencedKeys.filter(
                (ref) => ref.referenceType === 'Direct' || ref.referenceType === 'Position'
            )
            
            // Create edges for each child
            for (const childRef of childReferences) {
                // Look up the actual component to get its universalKey
                // (the key from referencedKeys might only have a local key)
                const childKey = childRef.key
                const childComponent = this._lookup(childKey.toJSON())
                if (childComponent?.universalKey) {
                    edges.push({
                        parent: parentUUID,
                        child: childComponent.universalKey
                    })
                }
            }
        }
        
        return edges
    }

    /**
     * Builds a directed graph from the parent-child edges in this StandardForm.
     * 
     * **Requires universalKey assignment**: This method relies on all components having
     * `universalKey` values assigned. When called from within `finalize()`, this should
     * be after the key-remapping step that assigns universalKeys to components that don't
     * have them.
     * 
     * The graph is constructed from edges collected via `_getParentChildEdges()`, with
     * nodes representing components (by universalKey) and edges representing parent→child
     * relationships.
     * 
     * @returns An object containing both the graph and its topological sort:
     *          - `graph`: A directed graph where:
     *            - Nodes = components (keyed by ComponentUUID)
     *            - Edges = parent→child relationships (from parent to child)
     *          - `topologicalSort`: Array of SCCs in topological order (`ComponentUUID[][]`)
     */
    _buildComponentGraph(): {
        graph: Graph<ComponentUUID, { key: ComponentUUID }, {}>;
        topologicalSort: ComponentUUID[][];
    } {
        // Get all parent-child edges
        const edges = this._getParentChildEdges()
        
        // Create nodes from all components with universalKey
        const nodes: Partial<Record<ComponentUUID, { key: ComponentUUID }>> = this._components
            .reduce<Partial<Record<ComponentUUID, { key: ComponentUUID }>>>(
                (acc, component) => {
                    if (component.universalKey) {
                        return { ...acc, [component.universalKey]: { key: component.universalKey }}
                    }
                    return acc
                },
                {}
            )
        
        // Convert edges from { parent, child } to { from, to } format for Graph
        const graphEdges = edges.map(({ parent, child }) => ({
            from: parent,
            to: child
        }))
        
        // Create directed graph
        const graph = new Graph<ComponentUUID, { key: ComponentUUID }, {}>(
            nodes,
            graphEdges,
            {}, // defaultItem (empty since we only need { key })
            true // directional = true (parent→child is directional)
        )
        
        // Compute topological sort
        const topologicalSort = graph.topologicalSort()
        
        return { graph, topologicalSort }
    }

    /**
     * Derives a topological sort from the component graph.
     * 
     * Returns an array of strongly connected components (SCCs), where each SCC is an array
     * of ComponentUUIDs. The outer array is in topological order (parents before children).
     * 
     * **Requires universalKey assignment**: This method relies on `_buildComponentGraph()`,
     * which requires all components to have `universalKey` values assigned (via `finalize()`).
     * 
     * @returns Array of SCCs in topological order: `ComponentUUID[][]`
     *          Each inner array represents a strongly connected component (nodes that form a cycle).
     *          For acyclic graphs, each SCC will contain a single node.
     */
    _getTopologicalSort(): ComponentUUID[][] {
        const { topologicalSort } = this._buildComponentGraph()
        return topologicalSort
    }

    get byUniversalId(): Record<ComponentUUID, StandardComponent> {
        const returnProxy = new Proxy(this, {
            get: (target, prop: ComponentUUID) => {
                const findComponent = target._components.find((component) => (component.universalKey === prop))
                if (findComponent) {
                    return findComponent
                }
                return undefined
            },
            has(target, prop: ComponentUUID): boolean {
                const findComponent = target._components.find((component) => (component.universalKey === prop))
                if (findComponent) {
                    return true
                }
                return false
            },
            set: (target, prop: ComponentUUID, value: StandardComponent): boolean => {
                if (isStandardComponent(value)) {
                    const findComponentIndex = target._components.findIndex((component) => (component.universalKey === prop))
                    if (findComponentIndex === -1) {
                        target._components.push(value)
                    }
                    else {
                        target._components = [
                            ...target._components.slice(0, findComponentIndex),
                            value,
                            ...target._components.slice(findComponentIndex + 1)
                        ]
                    }
                    return true
                }
                throw new Error('Invalid value in StandardForm byUniversalId setter')
            }

        })
        return returnProxy as unknown as Record<ComponentUUID, StandardComponent>
    }

    get universalKey(): AssetUUID { return this._universalKey }

    toJSON(options?: StandardToJSONOptions): StandardFormData {
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        const result: StandardFormData = {
            universalKey: this._universalKey,
            metaData: this.metaData,
            components: this._components.map((component) => (component.withMapping(mapKeys).remapReferences('universal').toJSON(options) as StandardComponentData))
        }
        // Include Asset-level metadata in JSON (following omission-over-empty principle)
        if (this._shortName) {
            result.shortName = this._shortName.toJSON()
        }
        if (this._summary) {
            result.summary = this._summary.toJSON()
        }
        return result
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
        const sortedChildren = this._components
            .filter(({ _key }) => ((_key.context ?? []).length === 0))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        const lookupWrapper = (key: string | StandardKey): StandardComponent | undefined => {
            if (typeof key === 'string') {
                return this._lookup(key)
            }
            return this._lookup(key.toJSON())
        }
        const children = sortedChildren
            .map((component) => (component.withMapping(mapKeys).remapReferences('key').nestedSchema(lookupWrapper, { context: [] })))
        return {
            data: { tag: 'Asset', uuid: this._universalKey, Story: undefined },
            children: [
                ...metaData.filter(treeNodeTypeguard(isSchemaMeta)),
                ...[this._shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
                ...[rebuildSchemaFromStandardRender(this._summary, { tag: 'Summary' })].filter(excludeUndefined),
                ...children
            ]
        }
    }

    _clone(): StandardForm {
        const returnValue = new StandardForm(this.universalKey)
        returnValue._metaData = [...this._metaData]
        returnValue._shortName = this._shortName
        returnValue._summary = this._summary
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
        returnValue._components = [...returnValue._components, ...incoming._clone()._components].reduce(mergeToComponentList(mergedUniversalKeyMappings), [])

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        returnValue._metaData = applyEdits(combinedMetaData.tree)

        // Merge Asset-level metadata
        if (this._shortName && incoming._shortName) {
            returnValue._shortName = this._shortName.merge(incoming._shortName)
        } else if (incoming._shortName) {
            returnValue._shortName = incoming._shortName
        }
        // Note: if this._shortName exists but incoming._shortName is undefined, 
        // we keep this._shortName (already set by _clone())

        if (this._summary && incoming._summary) {
            returnValue._summary = this._summary.merge(incoming._summary)
        } else if (incoming._summary) {
            returnValue._summary = incoming._summary
        }
        // Note: if this._summary exists but incoming._summary is undefined,
        // we keep this._summary (already set by _clone())

        return returnValue
    }

    subset(requests: StandardFormSubsetRequest[]): StandardForm {
        const returnValue = this._clone()
        returnValue._metaData = [...this._metaData]
        const mappings = this._components.map((component) => (component._key))
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
        // cascadeRequests performs a breadth-first traversal of the request space to determine the complete
        // list of requests including any created by cascading conditions. Each iteration processes one "hop"
        // in the graph traversal, ensuring we don't repeat work and can process requests in the correct order.
        //
        const cascadeRequests = (initialRequests: StandardFormSubsetRequest[], cascadeCondition: StandardFormSubsetCascadeCondition): StandardFormSubsetRequest[] => {
            // Phase 1: Graph traversal to record visits for this specific condition
            const visits: Array<{ key: StandardKey; nodes: Set<string> }> = []
            
            // Helper function to find or create a visit entry
            const findOrCreateVisit = (key: StandardKey): { key: StandardKey; nodes: Set<string> } => {
                const existing = visits.find(v => 
                    v.key.universalKey === key.universalKey && 
                    v.key.key === key.key && 
                    v.key.tag === key.tag
                )
                if (existing) return existing
                
                const newVisit = { key: key.clone(), nodes: new Set<string>() }
                visits.push(newVisit)
                return newVisit
            }
            
            // Initialize pending visits from this condition's start nodes
            let pendingVisits: Array<{ componentKey: StandardKey, nodeName: string }> = initialRequests
                .filter(request => request.cascadeConditions?.some(c => c === cascadeCondition))
                .flatMap(request => request.keys)
                .flatMap(key => 
                    cascadeCondition.startNodes.map(startNode => ({ componentKey: key, nodeName: startNode }))
                )
            

            
            // Traverse graph until no new visits are generated
            while (pendingVisits.length > 0) {
                const currentVisits = [...pendingVisits]
                pendingVisits = []
                

                
                currentVisits.forEach(({ componentKey, nodeName }) => {
                    // Record this visit
                    const visitEntry = findOrCreateVisit(componentKey)
                    visitEntry.nodes.add(nodeName)
                    
                    // Find the node in this condition's graph
                    const node = cascadeCondition.graph.find(n => n.name === nodeName)
                    if (!node) return
                    
                    // Find connected components through transitions
                    const component = this._lookup(componentKey.toJSON())
                    if (!component) return
                    
                    const referencedKeys = component.withMapping(mappings).referencedKeys()
                    const connectedKeys = referencedKeys
                        .filter(({ referenceType }) => 
                            node.transitions.some(t => t.connectionType === referenceType)
                        )
                        .map(({ key }) => key)
                    
                    // Add new visits for connected components
                    connectedKeys.forEach(connectedKey => {
                        node.transitions.forEach(transition => {
                            const targetNode = transition.targetNode
                            // Check if this would be a new visit
                            const existingVisit = visits.find(v => 
                                v.key.universalKey === connectedKey.universalKey && 
                                v.key.key === connectedKey.key && 
                                v.key.tag === connectedKey.tag
                            )
                            if (!existingVisit || !existingVisit.nodes.has(targetNode)) {
                                pendingVisits.push({ componentKey: connectedKey, nodeName: targetNode })
                            }
                        })
                    })
                })
            }
            

            
            // Phase 2: Generate requests from visits for this condition
            // Create a request for each component and let mergeIntoRequestList handle priority resolution
            const cascadeRequests = visits.reduce<StandardFormSubsetRequest[]>((requests, { key, nodes }) => {
                // Find the component using the key lookup
                const component = this._lookup(key.toJSON())
                if (!component) {
                    return requests
                }
                
                // Create a request for each node this component visited
                // mergeIntoRequestList will handle priority conflicts automatically
                return Array.from(nodes).reduce<StandardFormSubsetRequest[]>((currentRequests, nodeName) => {
                    const node = cascadeCondition.graph.find(n => n.name === nodeName)
                    if (!node) return currentRequests
                    
                    const cascadeRequest = {
                        requestType: node.requestType,
                        keys: [key]
                    }
                    
                    return mergeIntoRequestList(currentRequests, cascadeRequest)
                }, requests)
            }, [])
            

            
            return cascadeRequests
        }

        // Process each cascade condition separately, then merge results
        const allCascadeRequests = requests
            .flatMap(request => request.cascadeConditions ?? [])
            .flatMap(cascadeCondition => cascadeRequests(requests, cascadeCondition))
        
        // Merge all requests: initial + cascade results
        const allRequests = allCascadeRequests.reduce(mergeIntoRequestList, requests)
        const requestOutput = (request: StandardFormSubsetRequest, component: StandardComponent): StandardComponent[] => {
            if (request.requestType === 'Full') {
                return [component]
            }
            if (request.requestType === 'Stub' || request.requestType === 'ShortName' || request.requestType === 'ExitsAndShortName') {
                const returnValue = component.clone()
                if (returnValue instanceof StandardRoom) {
                    returnValue._payload = new StandardRoomPayload()
                    if ((request.requestType === 'ShortName' || request.requestType === 'ExitsAndShortName') && component instanceof StandardRoom) {
                        returnValue._payload._shortName = component._payload._shortName
                        if (request.requestType === 'ExitsAndShortName') {
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

        return returnValue
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardForm {
        const returnValue = this._clone()
        returnValue._components = returnValue._components.map((component) => (component.mapContents(callback)))
        return returnValue
    }

    withUpdatedUniversalKeys(callback: (key: string) => string | undefined): StandardForm {
        const returnValue = this._clone()
        returnValue._components = returnValue._components.map((component) => {
            const updatedUniversalKey = callback(component.key ?? '')
            if (updatedUniversalKey && !(component.universalKey === updatedUniversalKey)) {
                return component.withUniversalKey(updatedUniversalKey)
            }
            return component
        })
        return returnValue
    }

    assureComponent(reference: StandardKey): StandardForm {
        const returnValue = this._clone()
        const existingComponent = returnValue._lookup(reference.toJSON())
        if (existingComponent) {
            return returnValue
        }
        const newComponent = standardComponentFactory(defaultComponentFromTag(reference.tag, reference.key, reference.universalKey))?.withLeastCommonContext(reference.context ?? [])
        if (!newComponent) {
            throw new Error(`Unable to create component for tag ${reference.tag} with key ${reference.key} and universalKey ${reference.universalKey}`)
        }
        returnValue._components = [...returnValue._components, newComponent]
        const parentContext = reference.context?.slice(-1) ?? []
        if (parentContext.length > 0) {
            const parentComponent = parentContext[0].withContext(reference.context?.slice(0, -1) ?? [])
            const assuredValue = returnValue.assureComponent(parentComponent)
            assuredValue._components = assuredValue._components
                .map((component) => {
                    if (component._key.plain.equals(parentComponent.plain)) {
                        return component.withChild(new StandardReference(reference.plain))
                    }
                    return component
                })
            return assuredValue
        }
        return returnValue
    }

    finalize(): StandardForm {
        const returnValue = this._clone()
        const uuidGenerator = new UUIDGenerator()
        const uuidDefaultedComponents = returnValue._components
            .map((component) => {
                if (!component.universalKey) {
                    return component.withUniversalKey(`${component.tag.toUpperCase()}#${uuidGenerator.next()}`)
                }
                return component
            })
        returnValue._components = uuidDefaultedComponents
        
        // Build component graph from parent-child edges and compute topological sort
        // (Graph construction happens here, but topological resolution will be in Phase 4)
        // TODO: Use componentGraph and topologicalSort for topological resolution in Phase 4
        const { graph: componentGraph, topologicalSort } = returnValue._buildComponentGraph()
        
        const rebuiltContextComponents = uuidDefaultedComponents
            .sort(({ _key: keyA }, { _key: keyB }) => ((keyA.context ?? []).length - (keyB.context ?? []).length))
            .reduce<StandardComponent[]>((previous, component) => {
                if (component._key.context && component._key.context.length > 0) {
                    const directParentKey = component._key.context.slice(-1)[0]
                    const directParent = lookupInComponentList(previous, directParentKey)
                    if (directParent) {
                        const newContext = [...(directParent._key.context ?? []), directParent._key.plain.toFormat('universal')]
                        return [...previous, component.withLeastCommonContext(newContext)]
                    }
                }
                return [...previous, component]
            }, [])
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB)))
        returnValue._components = rebuiltContextComponents
        const hierarchyAssuredStandardForm = returnValue._components
            .reduce<StandardForm>((previous, component) => {
                const parentComponent = component._key.context?.slice(-1)[0]?.withContext(component._key.context?.slice(0, -1) ?? [])
                if (parentComponent) {
                    const assuredComponent = previous.assureComponent(parentComponent)
                    assuredComponent._components = assuredComponent._components
                        .map((existingComponent) => {
                            if (existingComponent._key.plain.equals(parentComponent.plain)) {
                                return existingComponent.withChild(new StandardReference(component._key.plain))
                            }
                            return existingComponent
                        })
                    return assuredComponent
                }
                return previous
            }, returnValue)
        const mappings: StandardKey[] = hierarchyAssuredStandardForm._components
            .map((component) => (component._key))
        returnValue._components = hierarchyAssuredStandardForm._components.map((component) => (component.withMapping(mappings).remapReferences('universal')))
        return returnValue
    }

    diff(incoming: StandardForm): StandardForm {

        //
        // In order to have a baseline between two StandardForms, we first merge the keys of both forms
        // (to draw associations between local keys and universal keys wherever they exist in either
        // data structure). This importantly simplifies the resulting diff, and makes it more useful.
        //
        const mergedForKeys = [...this._components, ...incoming._components]
            .reduce<StandardKey[]>((previous, component) => {
                const existingIndex = previous.findIndex((key) => (key.equals(component._key)))
                if (existingIndex === -1) {
                    return [...previous, component._key]
                }
                else {
                    return previous.map((key, index) => {
                        if (index === existingIndex) {
                            return key.merge(component._key)
                        }
                        return key
                    })
                }
            }, [])

        //
        // Sort the keys in the merged form by the standardComponentSortOrder, to provide an order in which
        // to diff the components in each StandardForm against each other.
        //

        const allKeys = new ReferenceList(
            [...this._components, ...incoming._components]
            .map((component) => (new StandardReference(component.referenceData)))
        ).toFormat('universal').payload.map((reference) => (reference._payload.plain.toJSON()))

        //
        // Next, we need a zippered version of the components in the two forms, with an
        // incoming component (if it exists) and a previous component (if it exists).
        //

        const zipperedComponents = allKeys
            .map((reference) => ({
                reference,
                previous: this._lookup(reference)?.withMapping(mergedForKeys)?.remapReferences('both'),
                incoming: incoming._lookup(reference)?.withMapping(mergedForKeys)?.remapReferences('both')
            }))
            .filter(({ previous, incoming }) => (previous || incoming))

        //
        // Now we can diff the components in the two forms against each other, using the
        // zipperedComponents as the basis for the diff.
        //

        const diffedValue = this._clone()
        const diffedComponents = zipperedComponents
            .reduce<StandardComponent[]>((previous, { previous: previousComponent, incoming: incomingComponent }) => {
                if (previousComponent && incomingComponent) {
                    const diffedComponent = previousComponent.diff(incomingComponent, {})
                    if (diffedComponent) {
                        return [...previous, diffedComponent]
                    } else {
                        return previous
                    }
                }
                else {
                    if (previousComponent) {
                        return [
                            ...previous,
                            new StandardRemove(previousComponent)
                        ]
                    }
                    if (incomingComponent) {
                        return [
                            ...previous,
                            incomingComponent
                        ]
                    }
                    throw new Error('diff error')
                }
            }, [])

        //
        // Find components that are not diffed, but appear nested inside of diff components of
        // StandardReplace or StandardRemove form (so that you can match terms completely in the
        // final diff)
        //
        diffedValue._components = diffedComponents
            .filter((component) => (component instanceof StandardReplace || component instanceof StandardRemove))
            .reduce<StandardComponent[]>((previous, component) => {
                const nestedComponents = this._components
                    .filter(({ _key }) => (Boolean((_key.context ?? []).find((contextKey) => (contextKey.equals(component._key.plain))))))
                    .filter(({ universalKey }) => (!Boolean(previous.find(({ universalKey: existingUniversalKey }) => (existingUniversalKey === universalKey)))))
                return [...previous, ...nestedComponents]
            }, diffedComponents)

        const combinedMetaData = new SchemaTagTree([...this._metaData, ...incoming._metaData])
        diffedValue._metaData = applyEdits(combinedMetaData.tree)

        // Diff Asset-level metadata
        diffedValue._shortName = this._shortName
            ? this._shortName.diff(incoming._shortName)
            : incoming._shortName
        diffedValue._summary = this._summary
            ? this._summary.diff(incoming._summary)
            : incoming._summary

        return diffedValue.finalize()
    }

    /**
     * Creates a clone of this StandardForm with an updated semantic mode.
     * 
     * @param semanticMode - The new semantic mode to set, or undefined to clear it
     * @returns A new StandardForm instance with the updated semantic mode
     */
    withSemanticMode(semanticMode: StandardFormSemanticMode | undefined): StandardForm {
        const returnValue = this._clone()
        returnValue.semanticMode = semanticMode
        return returnValue
    }

}
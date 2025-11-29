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
import { ComponentTag, StandardBaseData } from "./components/dataTypes/abstract"
import { StandardComponent, StandardComponentReferenceKey } from "./components/baseClasses"
import processComponents, { ComponentProcessingTemplate } from "./processComponents"
import { StandardRemove, StandardReplace } from "./components/edits"
import { standardComponentFactory } from "./componentFactory"
import { StandardToJSONOptions } from "./components/baseClasses"
import { AssetUUID, ComponentUUID, isSchemaAsset, isSchemaAssetUUID, isSchemaOutputTag, isSchemaWithKey, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport, isSchemaMeta } from "@tonylb/mtw-base/ts/schema/metaData"
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaLink } from "@tonylb/mtw-base/ts/schema/renderTree"
import StandardCharacter from "./components/character"
import { isSchemaTreeNode, nodeFromWML } from "../schema"
import { mergeToComponentList, mergeUniversalKeyMappings } from "./mergeToComponentList"
import { ReferenceListData, StandardReferenceData, StandardKeyData } from "./components/dataTypes/reference"
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
import { unique } from "../list"

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
    _topLevel?: ReferenceList;
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
            this._topLevel = args.topLevel ? new ReferenceList(args.topLevel) : undefined

            // Generate implicit parents
            const withImplicitParents = this.generateImplicitParents()
            this._components = withImplicitParents._components
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
            this._topLevel = (assetLine as any).topLevel ? new ReferenceList((assetLine as any).topLevel) : undefined
            
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

            // Generate implicit parents
            const withImplicitParents = this.generateImplicitParents()
            this._components = withImplicitParents._components
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

                const { components: componentFragments, topLevel: topLevelKeys } = processComponents({ 
                    componentTemplates, 
                    schema: node.children,
                    assetUUID: this._universalKey
                })
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
                            new StandardKey(
                                previousMatch.key ?? component.key
                                    ? {
                                        universalKey: previousMatch.universalKey ?? component.universalKey,
                                        key: previousMatch.key ?? component.key!
                                    }
                                    : (previousMatch.universalKey ?? component.universalKey ?? '')
                            ),
                            ...previous.slice(previousMatchIndex + 1)
                        ]
                    }, [])
                    .filter(({ key, universalKey }) => (key || universalKey))
                this._components = componentFragments
                    .reduce<StandardComponent[]>(mergeToComponentList(universalKeyMappings), [])
                    
                // Populate topLevel from processComponents result
                if (topLevelKeys.length > 0) {
                    // Convert StandardKeys to reference format
                    const topLevelReferences = topLevelKeys.map(key => {
                        const component = this._lookup(key.toJSON())
                        if (component) {
                            return component.referenceData
                        }
                        return key.toJSON() // Fallback to key JSON if component not found
                    })
                    this._topLevel = new ReferenceList(topLevelReferences)
                }
                
                // Generate implicit parents using StandardKey (works before finalize)
                const withImplicitParents = this.generateImplicitParents()
                // Sort after implicitParent is available, so sortOrder can use it instead of context
                // Create lookup helper for sorting - convert StandardComponent to new lookup result format
                const lookup = (key: StandardKey) => {
                    const component = withImplicitParents._lookup(key.toJSON())
                    if (!component) return undefined
                    return {
                        reference: component.reference.plain(),
                        implicitParent: component.implicitParent
                    }
                }
                this._components = withImplicitParents._components
                    .sort((componentA, componentB) => (standardComponentSortOrder(componentA._key, componentB._key, lookup)))
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

    get header(): { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree>; topLevel?: ReferenceListData } & StandardBaseData & SerializeNDJSONMixin {
        const header: { tag: 'Asset'; shortName?: StandardEditableData<string>; summary?: StandardEditableData<RenderTree>; topLevel?: ReferenceListData } & StandardBaseData & SerializeNDJSONMixin = {
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
        if (this._topLevel) {
            header.topLevel = this._topLevel.toJSON()
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

    referencedKeys(): StandardComponentReferenceKey[] {
        if (!this._topLevel) {
            return []
        }
        // Convert topLevel references to StandardComponentReferenceKey format
        return this._topLevel.payload.map(ref => ({
            key: ref.plain().standardKey,
            referenceType: 'Direct' as const
        }))
    }

    /**
     * Computes parent→child edges using StandardKey (works before finalize()).
     * 
     * This version uses StandardKey instead of ComponentUUID, allowing it to work
     * before finalize() has assigned universalKeys. Used by generateImplicitParents().
     * 
     * Edges are computed on-demand from:
     * 1. component.referencedKeys() filtered for 'Direct' or 'Position' reference types (component→component edges)
     * 2. StandardForm.topLevel (Asset→component edges for Asset-level components)
     * 
     * @returns Array of parent→child edge pairs, where each edge uses StandardKey | AssetUUID
     */
    _getParentChildEdges(): Array<{ parent: StandardKey | AssetUUID; child: StandardKey }> {
        // Helper function to extract edges from an entity with StandardKey and referencedKeys
        const getEdges = (
            entity: { _key?: { plain: StandardKey }; universalKey?: ComponentUUID | AssetUUID; referencedKeys(): StandardComponentReferenceKey[] }
        ): Array<{ parent: StandardKey | AssetUUID; child: StandardKey }> => {
            // For Asset-level, use AssetUUID; for components, use StandardKey
            const parentKey: StandardKey | AssetUUID | undefined = entity.universalKey?.startsWith('ASSET#')
                ? entity.universalKey as AssetUUID
                : entity._key?.plain
            
            if (!parentKey) {
                return []
            }
            
            const childReferences = entity.referencedKeys().filter(
                (ref) => ref.referenceType === 'Direct' || ref.referenceType === 'Position'
            )
            
            return childReferences.reduce<Array<{ parent: StandardKey | AssetUUID; child: StandardKey }>>(
                (childAcc, childRef) => {
                    // Use the StandardKey directly from referencedKeys
                    const childKey = childRef.key
                    return [...childAcc, { parent: parentKey, child: childKey }]
                },
                []
            )
        }
        
        const edges = [this, ...this._components].reduce<Array<{ parent: StandardKey | AssetUUID; child: StandardKey }>>(
            (acc, entity) => ([...acc, ...getEdges(entity)]),
            []
        )
        
        return edges
    }

    /**
     * Gets the ancestry chain for a component by traversing its implicitParent chain.
     * 
     * Returns an array of ComponentUUID[] representing the chain from Asset level (earliest ancestor)
     * to direct parent (most proximate ancestor). This matches the order of the old `context` array.
     * 
     * Note: This does NOT include the current component itself, only ancestors.
     * 
     * **Note on implicit vs explicit parent**: This function currently only uses `implicitParent`.
     * As we add more nuanced interaction between implicit and explicit parent, we may want to
     * modify this to consider both parent types (e.g., explicit parent takes precedence, or merge both chains).
     * 
     * @param component The component to get the ancestry chain for
     * @returns Array of ComponentUUID[] representing the ancestry chain (earliest to most proximate),
     *          empty array for Asset-level components
     */
    _getAncestryChainFromImplicitParent(component: StandardComponent): StandardKey[] {
        let chain: StandardKey[] = []
        let current: StandardComponent | undefined = component
        
        // Traverse up the implicitParent chain, building chain from most proximate to earliest
        let visited: StandardKey[] = []
        while (current?.implicitParent) {
            const parentKey = current.implicitParent  // StandardKey
            
            // Look up parent component by StandardKey
            const parentComponent = this._lookup(parentKey.toJSON())
            
            // Cycle detection
            if (visited.some(visitedKey => visitedKey.equals(parentKey))) {
                throw new Error(`Cycle detected in implicitParent chain: ${JSON.stringify(parentKey)} appears multiple times. Chain: ${visited.map(key => JSON.stringify(key)).join(' -> ')} -> ${JSON.stringify(parentKey)}`)
            }
            visited = [...visited, parentKey]
            
            // Add parent to chain (most proximate first)
            chain = [...chain, parentKey]
            
            // Continue traversal with parent component
            current = parentComponent
        }
        
        // Reverse to get order from Asset level (earliest) to direct parent (most proximate)
        // This matches the old context array format: [earliest ancestor, ..., direct parent]
        return chain.reverse()
    }

    /**
     * Extracts the direct parent from a context array (for migration/backward compatibility).
     * 
     * Helper function to extract the direct parent from the old context array format.
     * Used when converting from old context-based code to implicitParent-based code.
     * 
     * @param context The context array (old format)
     * @returns The direct parent StandardKey (last item in context), or undefined if empty
     */
    _extractParentFromContext(context: StandardKey[]): StandardKey | undefined {
        return context.length > 0 ? context[context.length - 1] : undefined
    }

    /**
     * Builds a directed graph using StandardKey (works before finalize()).
     * 
     * This version creates synthetic UUIDs for StandardKeys and merges StandardKeys
     * that refer to the same component (by matching key+tag or universalKey).
     * Used by generateImplicitParents() to work before finalize().
     * 
     * @returns Graph with synthetic UUID keys, topological sort, and mapping from synthetic UUID to StandardKey
     */
    _buildComponentGraph(): {
        graph: Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>;
        topologicalSort: string[][];
    } {
        const edges = this._getParentChildEdges()
        const uuidGenerator = new UUIDGenerator()
        
        // Array to track StandardKey → synthetic UUID
        // We merge StandardKeys that refer to the same component
        const keyMappings: { key: StandardKey | AssetUUID; syntheticKey: string }[] = []
        
        // Helper to get or create synthetic UUID for a StandardKey or AssetUUID
        const getSyntheticUUID = (key: StandardKey | AssetUUID): string => {
            // For AssetUUID, use it directly (no need for synthetic)
            if (typeof key === 'string' && key.startsWith('ASSET#')) {
                const existing = keyMappings.find(m => typeof m.key === 'string' && m.key === key)
                if (!existing) {
                    keyMappings.push({ key, syntheticKey: key })
                }
                return key
            }
            
            // For StandardKey, check if we've seen an equivalent one
            const standardKey = key as StandardKey
            
            // Check if we've already seen this exact StandardKey or an equivalent one
            const existingMatch = keyMappings.find(m => {
                if (typeof m.key === 'string') {
                    // Skip AssetUUID entries
                    return false
                }
                const existingKey = m.key as StandardKey
                return existingKey.equals(standardKey)
            })
            
            if (existingMatch) {
                // Use existing synthetic UUID
                return existingMatch.syntheticKey
            }
            
            // Create new synthetic UUID
            const syntheticUUID = `SYNTHETIC#${uuidGenerator.next()}`
            keyMappings.push({ key: standardKey, syntheticKey: syntheticUUID })
            return syntheticUUID
        }
        
        // Create nodes from all unique StandardKeys/AssetUUIDs in edges
        const nodeKeys = new Set<string>()
        edges.forEach(edge => {
            nodeKeys.add(getSyntheticUUID(edge.parent))
            nodeKeys.add(getSyntheticUUID(edge.child))
        })
        
        // Build node data with StandardKey information
        const nodes: Partial<Record<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }>> = {}
        nodeKeys.forEach(syntheticUUID => {
            const mapping = keyMappings.find(m => m.syntheticKey === syntheticUUID)
            const nodeData: { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID } = { key: syntheticUUID }
            
            if (mapping && typeof mapping.key !== 'string') {
                // StandardKey (not AssetUUID)
                const standardKey = mapping.key as StandardKey
                nodeData.standardKey = standardKey
                if (standardKey.universalKey) {
                    nodeData.componentUUID = standardKey.universalKey as ComponentUUID
                }
            }
            
            nodes[syntheticUUID] = nodeData
        })
        
        // Convert edges to use synthetic UUIDs
        const graphEdges = edges.map(({ parent, child }) => ({
            from: getSyntheticUUID(parent),
            to: getSyntheticUUID(child)
        }))
        
        // Create directed graph
        const graph = new Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>(
            nodes,
            graphEdges,
            {}, // defaultItem
            true // directional = true
        )
        
        // Compute topological sort
        const topologicalSort = graph.topologicalSort()
        
        return { graph, topologicalSort }
    }

    /**
     * Generates implicit parent relationships using StandardKey (works before finalize()).
     * 
     * This method creates a graph using StandardKey instead of ComponentUUID, allowing it
     * to work before finalize() has assigned universalKeys. Sets `_implicitParent` on
     * components as a StandardKey.
     * 
     * @returns Updated StandardForm with implicitParent set on all components
     */
    generateImplicitParents(): StandardForm {
        const { graph, topologicalSort } = this._buildComponentGraph()
        
        // Helper to get StandardKey or AssetUUID from a synthetic UUID
        const getStandardKeyOrAsset = (syntheticUUID: string): StandardKey | AssetUUID | undefined => {
            // AssetUUID synthetic UUIDs are the AssetUUID itself
            if (syntheticUUID.startsWith('ASSET#')) {
                return syntheticUUID as AssetUUID
            }
            // For components, get StandardKey from node data
            return graph.nodes[syntheticUUID]?.standardKey
        }
        
        // Helper to find longest common prefix of multiple arrays
        const longestCommonPrefix = (arrays: (StandardKey | AssetUUID)[][]): (StandardKey | AssetUUID)[] => {
            return arrays.reduce((previousPrefix, curr) => {
                const { prefix } = curr.reduce<{ prefix: (StandardKey | AssetUUID)[]; matchFailed: boolean }>(({ prefix, matchFailed }, curr, index) => {
                    if (matchFailed || index >= previousPrefix.length) {
                        return { prefix, matchFailed }
                    }
                    const previousKey = prefix[index]

                    if (
                        (previousKey instanceof StandardKey && curr instanceof StandardKey && previousKey.equals(curr)) ||
                        (typeof previousKey === 'string' && typeof curr === 'string' && previousKey === curr)
                    ) {
                        return { prefix: [...prefix, curr], matchFailed: false }
                    }
                    return { prefix, matchFailed: true }
                }, { prefix: previousPrefix, matchFailed: false })
                return prefix
            }, arrays[0] ?? [this._universalKey])
        }
        
        const returnValue = this._clone()

        // Reduce over topological sort (process parents before children)
        for (const scc of topologicalSort) {

            const externalParents = unique(scc.reduce<string[]>((previous, current) => {
                const graphNode = graph.getNode(current)
                if (graphNode) {
                    const backEdges = graphNode.backEdges
                    return [
                        ...previous,
                        ...backEdges
                            .map(edge => edge.from)
                            .filter(parent => !scc.includes(parent))
                    ]
                }
                return previous
            }, []))

            //
            // If `ASSET#` is one of the external parents, then we know immediately that there is no
            // implicit component parent for this group of components.
            //
            if (externalParents.some(parent => parent.startsWith('ASSET#'))) {
                const keysToUpdate = scc
                    .filter(key => !isSchemaAssetUUID(key))
                    .map((key) => (graph.nodes[key]?.standardKey))
                    .filter((key): key is StandardKey => key !== undefined)

                returnValue._components = returnValue._components.map(component => {
                    if (keysToUpdate.some(key => key.equals(component._key.plain))) {
                        return component.withImplicitParent(undefined)
                    }
                    return component
                })
                continue
            }
            
            const getAncestryThread = (key: StandardKey): StandardKey[] => {
                const component = returnValue._lookup(key.toJSON())
                if (component) {
                    const ancestryChain = component.implicitParent ? getAncestryThread(component.implicitParent) : []
                    return [...ancestryChain, key]
                }
                return []
            }
            const ancestryThreads: StandardKey[][] = externalParents.map(parentSyntheticUUID => {
                const parentKeyOrAsset = getStandardKeyOrAsset(parentSyntheticUUID) as StandardKey
                return getAncestryThread(parentKeyOrAsset)
            })
            
            const commonAncestry = longestCommonPrefix(ancestryThreads)

            const implicitParentEntry = commonAncestry.length > 0 ? commonAncestry[commonAncestry.length - 1] : undefined
            const implicitParentKey = implicitParentEntry instanceof StandardKey ? implicitParentEntry.plain : undefined

            const keysToUpdate = scc
                .filter(key => !isSchemaAssetUUID(key))
                .map((key) => (graph.nodes[key]?.standardKey))
                .filter((key): key is StandardKey => key !== undefined)

            returnValue._components = returnValue._components.map(component => {
                if (keysToUpdate.some(key => key.equals(component._key.plain))) {
                    return component.withImplicitParent(implicitParentKey)
                }
                return component
            })
        }
                
        return returnValue
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
        if (this._topLevel) {
            result.topLevel = this._topLevel.toJSON()
        }
        return result
    }

    toNDJSON(): StandardNDJSON {
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        // Create lookup helper for sorting - convert StandardComponent to new lookup result format
        const lookup = (key: StandardKey) => {
            const component = this._lookup(key.toJSON())
            if (!component) return undefined
            return {
                reference: component.reference.plain(),
                implicitParent: component.implicitParent
            }
        }
        const components: (StandardComponentData & SerializeNDJSONMixin)[] = this._components
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB, lookup)))
            .map((component) => (component.withMapping(mapKeys).remapReferences('universal').toJSON()))
        return [
            this.header,
            ...components
        ]
    }

    get schema(): GenericTreeNode<SchemaTag> {
        const metaData = this.metaData
        // Create lookup helper for sorting - convert StandardComponent to new lookup result format
        const lookup = (key: StandardKey) => {
            const component = this._lookup(key.toJSON())
            if (!component) return undefined
            return {
                reference: component.reference.plain(),
                implicitParent: component.implicitParent
            }
        }
        const sortedChildren = this._components
            .filter((component) => (!component.implicitParent))
            .sort(({ _key: keyA }, { _key: keyB }) => (standardComponentSortOrder(keyA, keyB, lookup)))
        const mapKeys = this._components.map(({ _key }) => (_key.plain))
        const lookupWrapper = (key: string | StandardKey): StandardComponent | undefined => {
            if (typeof key === 'string') {
                // String is assumed to be ComponentUUID (part of StandardKeyData)
                return this._lookup(key as ComponentUUID)
            }
            return this._lookup(key.toJSON())
        }
        const children = sortedChildren
            .map((component) => (component.withMapping(mapKeys).remapReferences('key').nestedSchema(lookupWrapper, { parent: undefined })))
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
        returnValue._topLevel = this._topLevel ? this._topLevel.clone() : undefined
        returnValue._components = this._components.map((component) => (component.clone()))
        return returnValue
    }

    get _keys(): StandardKey[] {
        return this._components
            .map((component) => (component._key))
    }

    _lookup(keyData: StandardKeyData): StandardComponent | undefined {
        return lookupInComponentList(this._components, new StandardKey(keyData))
    }

    //
    // StandardForm merge method accounts for component-level edits (like StandardRemove and StandardReplace)
    // and merges all contents in place
    //
    // TODO: Revisit merge() logic after context removal - should use buildComponentGraph to determine
    // proper parent relationships when components appear in multiple contexts. The current context
    // intersection in StandardKey.merge() is a temporary measure that will be removed.
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

        return returnValue.generateImplicitParents()
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

        return returnValue.generateImplicitParents()
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

    finalize(): StandardForm {
        let returnValue = this._clone()
        const uuidGenerator = new UUIDGenerator()
        const uuidDefaultedComponents = returnValue._components
            .map((component) => {
                if (!component.universalKey) {
                    return component.withUniversalKey(`${component.tag.toUpperCase()}#${uuidGenerator.next()}`)
                }
                return component
            })
        returnValue._components = uuidDefaultedComponents
        returnValue = returnValue.generateImplicitParents()
        
        // Hierarchy assurance: Add child references to parent components
        returnValue._components = returnValue._components
            .map((component) => {
                const implicitChildren = returnValue._components
                    .filter(({ implicitParent }) => (implicitParent && implicitParent.equals(component._key.plain)))
                if (implicitChildren.length > 0) {
                    //
                    // If the component is the implicit parent, assure that it includes all
                    // the child references
                    //
                    // TODO: We need to change this when explicitParent is implemented, so that
                    // it does not add a child reference to the implicit parent if positioning
                    // will be overridden by an explicit parent. That may involve moving the
                    // child reference addition to the finalize() step.
                    //
                    // TODO: We need to evaluate whether this adds the right type of reference
                    // when different StandardKey types (e.g. add and replace) are combined by
                    // the implicit-parent mechanism.
                    //
                    return implicitChildren.reduce<StandardComponent>((previous, current) => {
                        return previous.withChild(new StandardReference(current._key.plain))
                    }, component)
                }
                return component
            })

        const mappings: StandardKey[] = returnValue._components
            .map((component) => (component._key))
        returnValue._components = returnValue._components.map((component) => (component.withMapping(mappings).remapReferences('universal')))
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
            .map((reference: StandardReferenceData) => {
                // Convert StandardReferenceData to StandardKeyData by removing tag if present
                const keyData: StandardKeyData = typeof reference === 'string' 
                    ? reference 
                    : { key: reference.key, universalKey: reference.universalKey }
                return {
                    reference,
                    previous: this._lookup(keyData)?.withMapping(mergedForKeys)?.remapReferences('both'),
                    incoming: incoming._lookup(keyData)?.withMapping(mergedForKeys)?.remapReferences('both')
                }
            })
            .filter(({ previous, incoming }) => (previous || incoming))

        //
        // Now we can diff the components in the two forms against each other, using the
        // zipperedComponents as the basis for the diff.
        //

        const diffedValue = this._clone()
        const diffedComponents: StandardComponent[] = zipperedComponents
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
        // TODO: Revisit this logic after context removal - should use buildComponentGraph to determine
        // cascade-delete behavior based on whether components appear with other parents that still have connections.
        // For now, use implicitParent to find nested components (replaces context-based lookup).
        diffedValue._components = diffedComponents
            .filter((component) => (component instanceof StandardReplace || component instanceof StandardRemove))
            .reduce<StandardComponent[]>((previous, component) => {
                const nestedComponents = this._components
                    .filter((childComponent) => childComponent.implicitParent?.equals(component._key))
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

        return diffedValue.generateImplicitParents()
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
import { StandardComponent, StandardComponentReferenceKey } from "./components/baseClasses"
import { ComponentTag } from "./components/dataTypes/abstract"
import { StandardKey } from "./components/reference"
import { ReferenceList } from "./components/reference"
import { AssetUUID, ComponentUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { Graph } from "@tonylb/mtw-utilities/ts/graphStorage/utils/graph"
import { UUIDGenerator } from "@tonylb/mtw-utilities/ts/uuid/index"
import { StandardExplicitParent, StandardExplicitParentSimple, StandardExplicitParentRemove, StandardExplicitParentReplace } from "./explicit/parent"
import { excludeUndefined } from "../lib/lists"
import { unique } from "../list"
import { KeyLookup } from "./keyLookup"
import { StandardReference, referenceSortOrder } from "./components/reference"

export class SchemaOrganization {
    private _organization: Array<{ key: StandardKey; implicitParent?: StandardKey }>
    private _explicitOrganization: Array<{ key: StandardKey; parent: StandardKey | undefined }>
    private components: StandardComponent[]
    private assetUUID: AssetUUID
    private keyLookup: KeyLookup
    private _topLevel?: ReferenceList

    constructor(args: {
        components: StandardComponent[]
        assetUUID: AssetUUID
        topLevel?: ReferenceList
        keyLookup: KeyLookup
    }) {
        this.components = args.components
        this.assetUUID = args.assetUUID
        this.keyLookup = args.keyLookup
        this._topLevel = args.topLevel
        this._explicitOrganization = this._calculateExplicitParents()
        this._organization = this._calculateImplicitParents()
    }

    getImplicitParent(key: StandardKey): StandardKey | undefined {
        const entry = this._organization.find((entry) => (entry.key.equals(key)))
        return entry?.implicitParent
    }

    getExplicitParent(key: StandardKey): { explicitParent: StandardKey | undefined } | undefined {
        const entry = this._explicitOrganization.find((entry) => (entry.key.equals(key)))
        if (entry === undefined) {
            return undefined
        }
        return { explicitParent: entry.parent }
    }

    getChildrenOfParent(parent: StandardKey | undefined): StandardReference[] {
        return this.components
            .filter((component) => {
                const componentKey = component._key?.plain
                if (!componentKey) {
                    return false
                }

                const explicitParentResult = this.getExplicitParent(componentKey)

                // Explicit parent takes precedence
                if (explicitParentResult !== undefined) {
                    const explicitParent = explicitParentResult.explicitParent
                    // Compare using .equals() for StandardKey objects, or === for undefined
                    const matches = explicitParent === undefined 
                        ? parent === undefined
                        : explicitParent !== undefined && parent !== undefined && explicitParent.equals(parent)
                    return matches
                }

                // Implicit parent as fallback (only when no explicit parent data exists)
                const implicitParent = this.getImplicitParent(componentKey)
                // Compare using .equals() for StandardKey objects, or === for undefined
                return implicitParent === undefined
                    ? parent === undefined
                    : implicitParent !== undefined && parent !== undefined && implicitParent.equals(parent)
            })
            .map((component) => component.reference)
    }

    isParentContext(childKey: StandardKey, parentCandidate: StandardKey | undefined): boolean {
        const explicitParentResult = this.getExplicitParent(childKey)

        // Explicit parent takes precedence
        if (typeof explicitParentResult !== "undefined") {
            const explicitParent = explicitParentResult.explicitParent
            // Compare using .equals() for StandardKey objects, or === for undefined
            return explicitParent
                ? Boolean(parentCandidate && explicitParent.equals(parentCandidate))
                : typeof parentCandidate === "undefined"
        }

        // Implicit parent as fallback (only when no explicit parent data exists)
        const implicitParent = this.getImplicitParent(childKey)
        // Compare using .equals() for StandardKey objects, or === for undefined
        return implicitParent
            ? Boolean(parentCandidate && implicitParent.equals(parentCandidate))
            : typeof parentCandidate === "undefined"
    }

    /**
     * Builds an ancestry chain for a given key, traversing up through parents.
     * Returns the full chain from Asset level (earliest) to the given key (most proximate), with tags.
     * 
     * @param key - The StandardKey to build the ancestry chain for
     * @returns Array of StandardReference instances representing the ancestry chain
     */
    buildAncestryChain(key: StandardKey): StandardReference[] {
        const chain: StandardReference[] = []
        let current: StandardKey | undefined = key
        
        while (current) {
            // Find component to get tag
            const lookupResult = this.keyLookup.lookup(current)
            const componentTag = lookupResult?.component?.tag ?? current.tag
            if (!componentTag) {
                throw new Error(`Cannot determine tag for key in ancestry chain: ${JSON.stringify(current)}`)
            }
            
            // Ensure tag is a valid ComponentTag (not 'Remove' or 'Replace')
            // Components in organization should all be actual components, not edit wrappers
            if (componentTag === 'Remove' || componentTag === 'Replace') {
                throw new Error(`Invalid tag '${componentTag}' in ancestry chain - components should not be Remove/Replace wrappers`)
            }
            const tag = componentTag as ComponentTag
            
            chain.push(new StandardReference(current, tag))
            
            // Get parent (explicit takes precedence over implicit)
            const explicitParentResult = this.getExplicitParent(current)
            if (explicitParentResult !== undefined) {
                current = explicitParentResult.explicitParent ?? undefined
            } else {
                current = this.getImplicitParent(current)
            }
            
            // Stop at Asset level (undefined parent)
            if (current === undefined) {
                break
            }
        }
        
        // Reverse to get order from Asset level (earliest) to direct parent (most proximate)
        chain.reverse()
        return chain
    }

    /**
     * Sort order for components with nested parent-child relationships.
     * Uses ancestry chains to ensure parents come before children.
     * 
     * @param referenceA - First reference or key to compare
     * @param referenceB - Second reference or key to compare
     * @returns Negative if A < B, positive if A > B, zero if equal
     */
    sortOrder(
        referenceA: StandardReference | StandardKey,
        referenceB: StandardReference | StandardKey
    ): number {
        // Extract keys from references if needed
        const keyA = referenceA instanceof StandardReference ? referenceA.standardKey : referenceA
        const keyB = referenceB instanceof StandardReference ? referenceB.standardKey : referenceB
        
        // Build ancestry chains
        const chainA = this.buildAncestryChain(keyA)
        const chainB = this.buildAncestryChain(keyB)
        
        // Find first differing ancestor (same logic as current implementation)
        const differingIndex = chainA.findIndex((ancestorEntry, index) => 
            !(chainB.length > index && chainB[index].standardKey.equals(ancestorEntry.standardKey))
        )
        
        if (differingIndex === -1 || differingIndex >= chainB.length) {
            return chainA.length - chainB.length
        }
        
        // Compare at differing index using referenceSortOrder
        const elementA = chainA[differingIndex]
        const elementB = chainB[differingIndex]
        
        return referenceSortOrder(elementA, elementB)
    }

    /**
     * Checks if a component is directly referenced as a child.
     * A component is considered referenced if:
     * - It appears as a child (in the 'to' field) in any graph edge (from direct references in components or topLevel)
     * - It appears in the topLevel ReferenceList
     * 
     * This only checks direct references, not computed implicit/explicit parent relationships.
     * 
     * @param key - The StandardKey of the component to check
     * @returns true if the component is directly referenced, false otherwise
     */
    isReferenced(key: StandardKey): boolean {
        // Check if component appears in topLevel (asset-level reference)
        if (this._topLevel) {
            const isInTopLevel = this._topLevel.payload.some((ref) => {
                const refKey = ref.standardKey
                return refKey.equals(key)
            })
            if (isInTopLevel) {
                return true
            }
        }

        // Build graph with only direct references (implicit edges)
        const { graph } = this._buildComponentGraph()
        
        // Find the synthetic UUID for the component key
        const componentSyntheticUUID = Object.values(graph.nodes).find(
            (node) => node?.standardKey && node.standardKey.equals(key)
        )?.key
        
        if (!componentSyntheticUUID) {
            // Component not in graph, so it's not referenced
            return false
        }
        
        // Check if any edge has this component as a child (in the 'to' field)
        return graph.edges.some(edge => edge.to === componentSyntheticUUID)
    }

    private _getParentChildEdges(): Array<{ parent: StandardKey | AssetUUID; child: StandardKey }> {
        // Create a pseudo-entity for Asset-level references from topLevel
        const topLevel = this._topLevel
        const assetEntity: { universalKey: AssetUUID; referencedKeys(): StandardComponentReferenceKey[] } = {
            universalKey: this.assetUUID,
            referencedKeys(): StandardComponentReferenceKey[] {
                if (!topLevel) {
                    return []
                }
                // Convert topLevel references to StandardComponentReferenceKey format
                return topLevel.payload
                    .map(ref => ({
                        reference: ref,
                        referenceType: 'Direct' as const
                    }))
            }
        }
        
        // Phase 1: Collect all references with their parent keys
        const allReferences = [assetEntity, ...this.components].reduce<Array<{ parent: StandardKey | AssetUUID; childRef: StandardComponentReferenceKey }>>(
            (acc, entity) => {
                // For Asset-level, use AssetUUID; for components, use StandardKey
                const parentKey: StandardKey | AssetUUID | undefined = entity.universalKey?.startsWith('ASSET#')
                    ? entity.universalKey as AssetUUID
                    : ('_key' in entity && entity._key?.plain) ? entity._key.plain : undefined
                
                if (parentKey) {
                    // Collect references with 'Direct' or 'Position' types
                    const childReferences = entity.referencedKeys().filter(
                        (ref) => ref.referenceType === 'Direct' || ref.referenceType === 'Position'
                    )
                    return [...acc, ...childReferences.map(childRef => ({ parent: parentKey, childRef }))]
                }
                return acc
            },
            []
        )
        
        // Phase 2: Group by child component using sameKey()
        const groupedReferences = allReferences.reduce<Array<Array<{ parent: StandardKey | AssetUUID; childRef: StandardComponentReferenceKey }>>>(
            (groups, item) => {
                // Find existing group that contains a reference to the same child
                const existingGroupIndex = groups.findIndex(group => 
                    group.some(existing => existing.childRef.reference.sameKey(item.childRef.reference))
                )
                
                if (existingGroupIndex >= 0) {
                    // Add to existing group
                    return groups.map((group, index) => 
                        index === existingGroupIndex ? [...group, item] : group
                    )
                } else {
                    // Create new group
                    return [...groups, [item]]
                }
            },
            []
        )
        
        // Phase 3: Apply global preference per group and flatten to edges
        return groupedReferences.flatMap(group => {
            // Check if ANY reference in the group has positive ref (addition)
            const hasPositiveRef = group.some(item => item.childRef.reference.ref > 0)
            
            // Filter based on preference: if positive refs exist, only use positive refs; otherwise use all (negative)
            const filteredGroup = hasPositiveRef
                ? group.filter(item => item.childRef.reference.ref > 0)
                : group
            
            // Flatten to edge format
            return filteredGroup.map(item => ({
                parent: item.parent,
                child: item.childRef.reference.standardKey
            }))
        })
    }

    private _getExplicitParentEdges(): Array<{ parent: StandardKey | AssetUUID; child: StandardKey }> {
        // Collect explicitParent edges (from <Parent> tags) - only for components
        return this.components.reduce<Array<{ parent: StandardKey | AssetUUID; child: StandardKey }>>(
            (acc, component) => {
                const childKey = component._key?.plain
                if (!childKey) {
                    return acc
                }
                
                const explicitParentResult = this.getExplicitParent(childKey)
                if (explicitParentResult === undefined) {
                    // No explicit parent - skip (don't add edge)
                    return acc
                } else if (explicitParentResult.explicitParent === undefined) {
                    // Asset-level explicit parent
                    return [...acc, { parent: this.assetUUID, child: childKey }]
                } else if (explicitParentResult.explicitParent instanceof StandardKey) {
                    // Component parent
                    return [...acc, { parent: explicitParentResult.explicitParent, child: childKey }]
                }
                return acc
            },
            []
        )
    }

    private _buildComponentGraph(): {
        graph: Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>;
        topologicalSort: string[][];
    } {
        const implicitEdges = this._getParentChildEdges()
        const explicitEdges = this._getExplicitParentEdges()
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
        
        // Build nodeKeys once from all edges (both graphs need the same nodes)
        const allEdges = [...implicitEdges, ...explicitEdges]
        const nodeKeys = new Set<string>()
        allEdges.forEach(edge => {
            nodeKeys.add(getSyntheticUUID(edge.parent))
            nodeKeys.add(getSyntheticUUID(edge.child))
        })
        
        // Build node data with StandardKey information (once, shared by both graphs)
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
        
        // Helper to build a graph from edges (using pre-built nodes)
        const buildGraphFromEdges = (edges: Array<{ parent: StandardKey | AssetUUID; child: StandardKey }>): Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}> => {
            // Convert edges to use synthetic UUIDs
            const graphEdges = edges.map(({ parent, child }) => ({
                from: getSyntheticUUID(parent),
                to: getSyntheticUUID(child)
            }))
            
            // Create directed graph
            return new Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>(
                nodes,
                graphEdges,
                {}, // defaultItem
                true // directional = true
            )
        }
        
        // Build graph with only implicit edges (for implicit parent calculation)
        const graph = buildGraphFromEdges(implicitEdges)
        
        // Build graph with implicit + explicit edges (for topological sort to avoid cycles)
        const graphWithExplicit = buildGraphFromEdges([...implicitEdges, ...explicitEdges])
        
        // Compute topological sort from the graph with explicit edges
        const topologicalSort = graphWithExplicit.topologicalSort()
        
        return { graph, topologicalSort }
    }

    private _calculateImplicitParents(): Array<{ key: StandardKey; implicitParent?: StandardKey }> {
        const { graph, topologicalSort } = this._buildComponentGraph()
        
        // Helper to find longest common prefix of multiple arrays (works with syntheticUUIDs)
        const longestCommonPrefix = (arrays: string[][]): string[] => {
            return arrays.reduce((previousPrefix, curr) => {
                const { prefix } = curr.reduce<{ prefix: string[]; matchFailed: boolean }>(({ prefix, matchFailed }, curr, index) => {
                    if (matchFailed || index >= previousPrefix.length) {
                        return { prefix, matchFailed }
                    }
                    const previousKey = previousPrefix[index]

                    if (previousKey === curr) {
                        return { prefix: [...prefix, curr], matchFailed: false }
                    }
                    return { prefix, matchFailed: true }
                }, { prefix: [], matchFailed: false })
                return prefix
            }, arrays[0] ?? [this.assetUUID])
        }
        
        const organization: Array<{ key: StandardKey; implicitParent?: StandardKey }> = []

        // Start with the original graph - we'll reconstruct it after each SCC
        let currentGraph = graph

        // Reduce over topological sort (process parents before children)
        for (const scc of topologicalSort) {

            const externalParents = unique(scc.reduce<string[]>((previous, current) => {
                const graphNode = currentGraph.getNode(current)
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
                    .map((key) => (currentGraph.nodes[key]?.standardKey))
                    .filter((key): key is StandardKey => key !== undefined)

                // Store implicitParent as undefined for asset-level components
                keysToUpdate.forEach(key => {
                    organization.push({ key, implicitParent: undefined })
                })

                // Step 1: Narrow the graph - Asset level components have edges from the ASSET node
                // Extract edges, remove edges that originate outside the SCC and end inside
                let narrowedEdges = currentGraph.edges.filter(edge => !(!scc.includes(edge.from) && scc.includes(edge.to)))
                
                // Add edges from the ASSET node to each node in SCC
                narrowedEdges = [...narrowedEdges, ...scc.map(nodeSyntheticUUID => ({
                    from: this.assetUUID,
                    to: nodeSyntheticUUID
                }))]
                
                currentGraph = new Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>(
                    currentGraph.nodes,
                    narrowedEdges,
                    {}, // defaultItem
                    true // directional = true
                )
                continue
            }
            
            // Get ancestry thread using graph traversal (works with syntheticUUIDs)
            // The graph has been narrowed, so backEdges reflect explicit parent overrides
            const getAncestryThread = (syntheticUUID: string): string[] => {
                // If this is the Asset level, return just the Asset
                if (syntheticUUID === this.assetUUID || syntheticUUID.startsWith('ASSET#')) {
                    return [this.assetUUID]
                }
                
                const graphNode = currentGraph.getNode(syntheticUUID)
                if (!graphNode) {
                    return [this.assetUUID]
                }
                
                // Get parent from backEdges (graph has been narrowed with explicit parent edges)
                const backEdges = graphNode.backEdges
                if (backEdges.length === 0) {
                    // No parent, must be at Asset level
                    return [this.assetUUID, syntheticUUID]
                }
                
                // Traverse up the ancestry chain
                const parentSyntheticUUID = backEdges[0].from // Should only be one parent after narrowing
                const ancestryChain = getAncestryThread(parentSyntheticUUID)
                return [...ancestryChain, syntheticUUID]
            }
            
            // Build ancestry threads from external parents (already syntheticUUIDs)
            const ancestryThreads: string[][] = externalParents.map(parentSyntheticUUID => {
                return getAncestryThread(parentSyntheticUUID)
            })
            
            const commonAncestry = longestCommonPrefix(ancestryThreads)

            // Convert the final syntheticUUID back to StandardKey
            const implicitParentSyntheticUUID = commonAncestry.length > 0 ? commonAncestry[commonAncestry.length - 1] : this.assetUUID
            const implicitParentKey = implicitParentSyntheticUUID.startsWith('ASSET#')
                ? undefined
                : currentGraph.nodes[implicitParentSyntheticUUID]?.standardKey?.plain

            const keysToUpdate = scc
                .filter(key => !isSchemaAssetUUID(key))
                .map((key) => (currentGraph.nodes[key]?.standardKey))
                .filter(excludeUndefined)

            // Store implicit parent information
            keysToUpdate.forEach(key => {
                organization.push({ key, implicitParent: implicitParentKey })
            })

            // Step 2: Narrow the graph by replacing all edges that end in nodes in this SCC
            // with a single edge from their parent (explicitParent if provided, else implicitParent) to each node
            // Extract edges, remove edges that originate outside the SCC and end inside
            //
            // This ensures that we can use currentGraph to extract ancestry in a way that is informed by the
            // decisions we have already made about previous SCCs.
            let narrowedEdges = currentGraph.edges.filter(edge => !(!scc.includes(edge.from) && scc.includes(edge.to)))
            
            // Helper function to determine the parent edge for a node
            const edgeFrom = (explicitParent: StandardExplicitParent | undefined, to: string, fallback: string): { from: string; to: string } => {
                // Check if explicitParent exists and is a Simple (not Remove/Replace)
                if (explicitParent?._payload instanceof StandardExplicitParentSimple) {
                    const explicitParentData = explicitParent._payload.payload.data
                    if (explicitParentData === 'ASSET') {
                        // Explicit parent is ASSET
                        return {
                            from: this.assetUUID,
                            to
                        }
                    } else if (explicitParentData instanceof StandardKey) {
                        // Find synthetic UUID for explicit parent
                        const explicitParentSyntheticUUID = Object.values(currentGraph.nodes)
                            .filter(excludeUndefined)
                            .find(({ standardKey }) => (standardKey && explicitParentData.equals(standardKey)))
                            ?.key
                        if (explicitParentSyntheticUUID) {
                            return {
                                from: explicitParentSyntheticUUID,
                                to
                            }
                        }
                    }
                }
                
                // Fallback to implicitParent if no explicitParent or couldn't resolve it
                return {
                    from: fallback,
                    to
                }
            }
            
            // For each node in the SCC, determine which parent to use (explicitParent overrides implicitParent)
            narrowedEdges = [...narrowedEdges, ...scc.map(nodeSyntheticUUID => {
                // Get the component for this node
                const nodeStandardKey = currentGraph.nodes[nodeSyntheticUUID]?.standardKey
                if (!nodeStandardKey) {
                    // Fallback to implicitParent if we can't find the component
                    return edgeFrom(undefined, nodeSyntheticUUID, implicitParentSyntheticUUID)
                }
                
                // Look up the component to get its explicitParent using KeyLookup
                const lookupResult = this.keyLookup.lookup(nodeStandardKey)
                const component = lookupResult.component
                return edgeFrom(component?.explicitParent, nodeSyntheticUUID, implicitParentSyntheticUUID)
            })]

            // Create new graph with narrowed edges
            currentGraph = new Graph<string, { key: string; standardKey?: StandardKey; componentUUID?: ComponentUUID }, {}>(
                currentGraph.nodes,
                narrowedEdges,
                {}, // defaultItem
                true // directional = true
            )
        }

        return organization
    }

    private _calculateExplicitParents(): Array<{ key: StandardKey; parent: StandardKey | undefined }> {
        return this.components.reduce<Array<{ key: StandardKey; parent: StandardKey | undefined }>>(
            (organization, component) => {
                const componentKey = component._key?.plain
                if (!componentKey) {
                    return organization
                }

                const explicitParent = component.explicitParent
                if (!explicitParent || !explicitParent._payload) {
                    // No explicit parent set - skip this component
                    return organization
                }

                const payload = explicitParent._payload

                if (payload instanceof StandardExplicitParentSimple) {
                    // Extract data from plain property (StandardExplicitParentSimpleBase)
                    const explicitParentData = payload.plain.data
                    
                    if (explicitParentData === 'ASSET') {
                        // Asset-level parentage - store as undefined
                        return [...organization, { key: componentKey, parent: undefined }]
                    } else if (explicitParentData instanceof StandardKey) {
                        // Component parent
                        return [...organization, { key: componentKey, parent: explicitParentData }]
                    } else if (typeof explicitParentData === 'string') {
                        // Handle string ComponentUUID - convert to StandardKey
                        return [...organization, { key: componentKey, parent: new StandardKey(explicitParentData) }]
                    }
                } else if (payload instanceof StandardExplicitParentRemove) {
                    // Removed explicit parent - no explicit parent set, so don't add entry
                    return organization
                } else if (payload instanceof StandardExplicitParentReplace) {
                    // Extract replacement value from plain property
                    const explicitParentData = payload.plain.data
                    
                    if (explicitParentData === 'ASSET') {
                        // Asset-level parentage - store as undefined
                        return [...organization, { key: componentKey, parent: undefined }]
                    } else if (explicitParentData instanceof StandardKey) {
                        // Component parent
                        return [...organization, { key: componentKey, parent: explicitParentData }]
                    }
                }
                
                return organization
            },
            []
        )
    }
}

/**
 * Minimal interface for querying component parentage information.
 * Provides a focused API for components to determine their parent context
 * and retrieve their children during schema rendering.
 */
export interface OrganizationContext {
    /**
     * Returns the implicit parent of a component, if one exists.
     * 
     * @param key - The StandardKey of the component to query
     * @returns The implicit parent StandardKey, or undefined if the component is at Asset level
     */
    getImplicitParent(key: StandardKey): StandardKey | undefined;

    /**
     * Returns all children of a given parent component or Asset.
     * 
     * @param parent - The StandardKey of the parent component, or AssetUUID for Asset-level children
     * @returns Array of StandardReference instances for all child components
     */
    getChildrenOfParent(parent: StandardKey | AssetUUID): StandardReference[];

    /**
     * Determines if a component is a child of the given parent candidate.
     * 
     * @param childKey - The StandardKey of the child component to check
     * @param parentCandidate - The StandardKey of the potential parent, or undefined for Asset-level
     * @returns true if the component is a child of the parent candidate, false otherwise
     */
    isParentContext(childKey: StandardKey, parentCandidate: StandardKey | undefined): boolean;
}

/**
 * Creates an OrganizationContext from a SchemaOrganization instance.
 * 
 * This factory function wraps a SchemaOrganization and provides the minimal
 * OrganizationContext interface. It handles type conversion between AssetUUID
 * (used in the interface) and undefined (used internally by SchemaOrganization).
 * 
 * @param organization - The SchemaOrganization instance to wrap
 * @returns An OrganizationContext that delegates to the provided SchemaOrganization
 */
export function createOrganizationContext(organization: SchemaOrganization): OrganizationContext {
    return {
        getImplicitParent(key: StandardKey): StandardKey | undefined {
            return organization.getImplicitParent(key);
        },

        getChildrenOfParent(parent: StandardKey | AssetUUID): StandardReference[] {
            // Convert AssetUUID to undefined for SchemaOrganization API
            const parentKey: StandardKey | undefined = typeof parent === 'string' && parent.startsWith('ASSET#')
                ? undefined
                : parent as StandardKey;
            return organization.getChildrenOfParent(parentKey);
        },

        isParentContext(childKey: StandardKey, parentCandidate: StandardKey | undefined): boolean {
            return organization.isParentContext(childKey, parentCandidate);
        }
    };
}


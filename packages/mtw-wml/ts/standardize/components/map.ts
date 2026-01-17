import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { findTaggedChildren, recurseIntoEditable } from "../../schema/utils"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { StandardMapData } from "./dataTypes/map"
import { ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMap } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image"
import { PositionFacetList, StandardPositionFacet } from "../keys/facets/position"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardLiteral } from "../literal"
import { StandardExplicitParent } from "../explicit"

/**
 * StandardMapPayload represents a Map component.
 * 
 * NOTE: Positions are stored using PositionFacetList, which follows the facet pattern
 * established by MarkFacetList in StandardExample. Each position facet contains a reference
 * to a Room and a payload with x, y coordinates.
 */
export class StandardMapPayload implements ComponentConstructorMethods<StandardMapData> {
    _name?: StandardLiteral;
    _images: GenericTree<SchemaTag> = [];
    _positions: PositionFacetList;
    tag = 'Map' as const

    constructor(previous?: StandardMapPayload) {
        if (previous) {
            this._name = previous._name
            this._images = [...previous._images]
            this._positions = previous._positions.clone()
        } else {
            this._positions = new PositionFacetList([])
        }
    }

    fromJSON(props: StandardMapData) {
        this._name = props.name ? new StandardLiteral(props.name, { tag: 'Name' }) : undefined
        this._images = props.images ?? []
        this._positions = new PositionFacetList(props.positions ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMap)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = findTaggedChildren({ children: node.children, tag: 'Name' })
            const imagesTagTree = tagTree.filter({ match: 'Image' })

            this._name = nameItem && nameItem.length > 0 ? new StandardLiteral(nameItem, { tag: 'Name' }) : undefined
            this._images = imagesTagTree.tree
            
            // Parse Position facets (Room tags with Position children)
            // findTaggedChildren handles Remove and Replace wrappers automatically
            const roomNodes = findTaggedChildren({ children: node.children, tag: 'Room' })
            
            // Helper function to check if a Room node contains Position children
            // Uses recurseIntoEditable to unwrap edit wrappers, then checks each content node for Position children
            const hasPositionChild = (node: GenericTreeNode<SchemaTag>): boolean => {
                return recurseIntoEditable(node, (contentNode) => {
                    // Check if this content node has Position children
                    const positionChildren = findTaggedChildren({ children: contentNode.children, tag: 'Position' })
                    return positionChildren.length > 0
                }).some(result => result)
            }
            
            const parsedFacets = roomNodes
                .filter(hasPositionChild)
                .map(roomNode => {
                    // Create StandardPositionFacet directly from schema - it will handle Replace/Remove/Plain dispatch
                    // StandardPositionFacet constructor accepts GenericTree<SchemaTag> and handles parsing internally
                    try {
                        return new StandardPositionFacet([roomNode])
                    }
                    catch (e) {
                        return undefined
                    }
                })
                .filter(excludeUndefined)
            this._positions = new PositionFacetList(parsedFacets)
            return
        }
        throw new Error('Schema mismatch in StandardMap constructor')
    }

    get name() { return this._name }
    get images() { return this._images }
    get positions() { return this._positions }

    toJSON(): Omit<StandardMapData, 'key' | 'universalKey'> {
        return {
            tag: 'Map',
            name: this.name?.toJSON(),
            ...(this.images.length ? { images: this.images } : {}),
            ...(this._positions.length ? { positions: this._positions.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        // schema() method doesn't have lookup context, so pass undefined
        // Position facets don't use lookup for rendering, so this is acceptable
        const positionSchemas = this._positions.items.map((facet) => {
            // Use renderFacet() to generate schema with Position child included
            // renderFacet() without referenceRender will use reference.schema and add Position
            const result = facet.renderFacet(undefined, undefined)
            return result.aggregatedNode ?? result.newNode
        }).filter(excludeUndefined) as GenericTreeNode<SchemaTag>[]
        
        const children = [
            ...this.name ? this.name.nestedSchema() : [],
            ...this.images,
            ...positionSchemas
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Map', key, uuid: universalKey },
            children
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key: mapKey } = options
        const mapKeyPlain = mapKey
        
        // Process each position facet
        const positionSchemas: GenericTreeNode<SchemaTag>[] = []
        for (const facet of this._positions.items) {
            const ref = facet.reference as StandardReference
            const roomKey = ref.standardKey
            const roomComponent = lookup(roomKey)
            
            // Check if room is parented to this map (explicit or implicit parentage)
            if (roomComponent && options.organization?.isParentContext(roomKey, mapKeyPlain)) {
                // Room is parented to map - get full room schema with all content
                const roomNestedSchema = roomComponent.nestedSchema(lookup, { 
                    ...options, 
                    key: roomKey, 
                    parent: mapKeyPlain 
                })
                
                // Render facet into room schema using renderFacet with referenceRender and lookup
                const result = facet.renderFacet(roomNestedSchema, lookup)
                
                if (result.aggregatedNode) {
                    positionSchemas.push(result.aggregatedNode)
                } else if (result.newNode) {
                    positionSchemas.push(result.newNode)
                }
            } else {
                // Room is not parented to map - render facet without referenceRender (position-only schema)
                const result = facet.renderFacet(undefined, lookup)
                
                if (result.aggregatedNode) {
                    positionSchemas.push(result.aggregatedNode)
                } else if (result.newNode) {
                    positionSchemas.push(result.newNode)
                }
            }
        }
        
        return {
            data: { tag: 'Map', key: mapKey.key ?? '', uuid: mapKey.universalKey },
            children: [
                ...this.name ? this.name.nestedSchema() : [],
                ...this.images,
                ...positionSchemas
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMapPayload()
        returnValue._name = this._name && incoming._name ? this._name.merge(incoming._name) : this._name ?? incoming._name,
        returnValue._images = applyEdits([...this.images, ...incoming.images])
        const mergedPositions = this._positions.merge(incoming._positions)
        returnValue._positions = mergedPositions ?? new PositionFacetList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardMapPayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        // Extract Position references (for Rooms)
        const positionReferences = this._positions.items.map((facet) => {
            // Facets are structural relationships with associated payload data
            const ref = facet.reference as StandardReference
            return { referenceType: 'Position' as const, reference: ref }
        })
        
        // Extract Image references from _images schema nodes
        const imageReferences = this._images
            .filter(treeNodeTypeguard(isSchemaImage))
            .map((imageNode) => {
                // Create StandardReference from Image schema node
                const imageReference = new StandardReference([imageNode])
                return { referenceType: 'Direct' as const, reference: imageReference }
            })
        
        return [...positionReferences, ...imageReferences]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMapPayload(this)
        // returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
        returnValue._images = callback(returnValue._images)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMapPayload(this)
        returnValue._positions = this._positions.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    isEmpty(): boolean {
        // A map is empty if it has no name, images, or positions
        const hasName = Boolean(this._name)
        const hasImages = this._images.length > 0
        const hasPositions = this._positions.length > 0
        return !(hasName || hasImages || hasPositions)
    }
}

export class StandardMap extends componentClassFactory(StandardMapPayload, 'StandardMap') {
    get name() { return this._payload.name }
    get images() { return this._payload.images }
    get positions() { return this._payload.positions }

    override _wrap(instance: StandardComponent): this {
        return new StandardMap(instance as StandardMap) as this
    }

    override clone(): StandardMap {
        const returnValue = new StandardMap(this)
        returnValue._payload = new StandardMapPayload(this._payload)
        return returnValue
    }

}

export default StandardMap

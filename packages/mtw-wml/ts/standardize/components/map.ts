import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey, NestedSchemaOptions } from "./baseClasses"
import { StandardMapData, StandardMapInputData } from "./dataTypes/map"
import { ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMap } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image"
import { PositionFacetList, StandardPositionFacet } from "../keys/facets/position"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardLiteral } from "../literal"
import {
    createShortNameFromJSON,
    mergeShortName,
    shortNameSchemaChildren,
    shortNameToJSON,
    standardizeShortNameConsumer,
} from "./shortNameField"
import type { StandardizeFromSchemaContext } from "../wmlStandardizeMode"
import { StandardExplicitParent } from "../explicit"
import { processWithConsumers, StandardizeConsumer, StandardizeConsumerFacetListPosition, StandardizeConsumerInline } from "./fromSchemaPipeline"
import { splitTaggedChildren } from "../../schema/utils"
import { renderReference } from "./utils/schema"

class StandardizeConsumerImageList<D extends object = object> implements StandardizeConsumer {
    constructor(
        private readonly context: D,
        private readonly options: {
            tag: SchemaTag["tag"]
            update: (this: D, nodes: GenericTree<SchemaTag>) => void
        }
    ) {}

    process(children: GenericTree<SchemaTag>) {
        const { matched, remainder } = splitTaggedChildren({
            children,
            tag: this.options.tag,
        })
        if (matched.length > 0) {
            this.options.update.call(this.context, matched)
        }
        return {
            parsingRemainder: remainder,
            returnRemainderAddition: matched
        }
    }
}

/**
 * StandardMapPayload represents a Map component.
 * 
 * NOTE: Positions are stored using PositionFacetList, which follows the facet pattern
 * established by MarkFacetList on Situation (marks). Each position facet contains a reference
 * to a Room and a payload with x, y coordinates.
 */
export class StandardMapPayload implements ComponentConstructorMethods<StandardMapInputData, StandardMapData> {
    _shortName?: StandardLiteral;
    _images: GenericTree<SchemaTag> = [];
    _positions: PositionFacetList;
    tag = 'Map' as const

    constructor(previous?: StandardMapPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._images = [...previous._images]
            this._positions = previous._positions.clone()
        } else {
            this._positions = new PositionFacetList([])
        }
    }

    fromJSON(props: StandardMapInputData) {
        this._shortName = createShortNameFromJSON(props.shortName)
        this._images = props.images ?? []
        this._positions = new PositionFacetList(props.positions ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>, _context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaMap)(node)) {
            const consumers = [
                standardizeShortNameConsumer(this),
                new StandardizeConsumerImageList<StandardMapPayload>(this, {
                    tag: "Image",
                    update(nodes) {
                        this._images = nodes
                    },
                }),
                new StandardizeConsumerFacetListPosition<StandardMapPayload>(this, {
                    update(list) {
                        this._positions = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]

            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardMap constructor')
    }

    get shortName() { return this._shortName }
    get images() { return this._images }
    get positions() { return this._positions }

    toJSON(): Omit<StandardMapData, 'key' | 'universalKey'> {
        return {
            tag: 'Map',
            shortName: shortNameToJSON(this.shortName),
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
            ...shortNameSchemaChildren(this.shortName),
            ...this.images,
            ...positionSchemas
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Map', key, uuid: universalKey },
            children
        }
    }

    /**
     * Prototype: assureReferences with FacetList data.
     * Map uses Position facets (Rooms) and _images schema nodes as "buckets".
     * Children already rendered by facets/images are excluded from remainder;
     * remainder (e.g. shared Feature) gets withRef(0) for inline rendering.
     * When we have more prototype-examples we can abstract a common pattern.
     */
    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const alreadyRenderedByPosition = (ref: StandardReference) =>
            this._positions.items.some(f => (f.reference as StandardReference).sameKey(ref))
        const imageKeysInImages = new Set(
            this._images.filter(treeNodeTypeguard(isSchemaImage)).map(n => n.data.key).filter((k): k is string => Boolean(k))
        )
        const alreadyRenderedAsImage = (ref: StandardReference) =>
            ref.tag === 'Image' && (ref.standardKey?.key != null) && imageKeysInImages.has(ref.standardKey.key)
        const remainder = children.filter(ref => !alreadyRenderedByPosition(ref) && !alreadyRenderedAsImage(ref))
        return {
            payload: this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key: mapKey } = options
        const mapKeyPlain = mapKey

        // When organization is present, use assureReferences to partition children:
        // facets/images excluded; remainder (e.g. shared Feature) with ref={0}.
        let inlineRemainder: StandardReference[] = []
        if (options.organization) {
            const children = options.organization.getChildrenOfParent(mapKey) ?? []
            const { inlineRemainder: remainder } = this.assureReferences(children)
            inlineRemainder = remainder
        }

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

        const inlineSchemas = inlineRemainder.map(renderReference({ lookup, options: { ...options, parent: mapKeyPlain } })).filter(excludeUndefined)

        return {
            data: { tag: 'Map', key: mapKey.key ?? '', uuid: mapKey.universalKey },
            children: [
                ...shortNameSchemaChildren(this.shortName),
                ...this.images,
                ...positionSchemas,
                ...inlineSchemas
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMapPayload()
        returnValue._shortName = mergeShortName(this._shortName, incoming._shortName)
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
        returnValue._images = callback(returnValue._images)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMapPayload(this)
        returnValue._positions = this._positions.lookup(props.mappings).toFormat(props.mapTo)
        return returnValue as this
    }

    isEmpty(): boolean {
        // A map is empty if it has no shortName, images, or positions
        const hasShortName = Boolean(this._shortName)
        const hasImages = this._images.length > 0
        const hasPositions = this._positions.length > 0
        return !(hasShortName || hasImages || hasPositions)
    }
}

export class StandardMap extends componentClassFactory(StandardMapPayload, 'StandardMap') {
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

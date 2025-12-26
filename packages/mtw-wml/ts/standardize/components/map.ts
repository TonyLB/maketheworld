import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, NestedSchemaOptions } from "./baseClasses"
import { StandardMapData } from "./dataTypes/map"
import { ReferenceFormat } from "./utils/references"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMap, isSchemaRoom, isSchemaPosition } from "@tonylb/mtw-base/ts/schema/components"
import StandardPosition, { mergeStandardPositionList, StandardPositionReplace, StandardPositionRemove, StandardPositionSimple } from "./position"
import StandardReference, { StandardKey } from "./reference"
import { StandardLiteral } from "../literal"
import { StandardExplicitParent } from "../explicit"

/**
 * StandardMapPayload represents a Map component.
 * 
 * NOTE: We do not currently handle having items parented to Map types, and cannot really
 * `assureReferences` against `StandardPosition`. This may need to be implemented in the future
 * as part of the SchemaOrganization refactor (Phase 4.3). The `_positions` array contains
 * `StandardPosition` objects, which have a different structure than `ReferenceList`-based
 * child references used by other components like `StandardRoom`.
 */
export class StandardMapPayload implements ComponentConstructorMethods<StandardMapData> {
    _name?: StandardLiteral;
    _images: GenericTree<SchemaTag> = [];
    _positions: StandardPosition[] = [];
    tag = 'Map' as const

    constructor(previous?: StandardMapPayload) {
        if (previous) {
            this._name = previous._name
            this._images = [...previous._images]
            this._positions = [...previous.positions]
        }
    }

    fromJSON(props: StandardMapData) {
        this._name = props.name ? new StandardLiteral(props.name) : undefined
        this._images = props.images ?? []
        this._positions = props.positions?.map((position) => (new StandardPosition(position))).filter(excludeUndefined) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMap)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree
                .filter({ match: 'Name' })
                .prune({ not: { or: [{ match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                .tree
            const positionsTagTree = tagTree
                .reordered([{ match: 'Room' }, { match: 'Position' }])
                .prune({ not: { or: [{ match: 'Room' }, { match: 'Position' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }]}})
            const imagesTagTree = tagTree.filter({ match: 'Image' })

            this._name = nameItem && nameItem.length > 0 ? new StandardLiteral(nameItem) : undefined
            this._images = imagesTagTree.tree
            this._positions = positionsTagTree.tree
                .map((position) => {
                    try {
                        return new StandardPosition([position])
                    }
                    catch (e) {
                        return undefined
                    }
                })
                .filter(excludeUndefined)
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
            ...(this.positions.length ? { positions: this.positions.map((position) => position.toJSON()) } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Map', key, uuid: universalKey },
            children: [
                ...this.name ? this.name.nestedSchema({ tag: 'Name' }) : [],
                ...this.images,
                ...this.positions.map((position) => position.schema).filter(excludeUndefined).flat(1)
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key: mapKey } = options
        const mapKeyPlain = mapKey.plain
        
        // Process each position
        const positionSchemas = this.positions.map((position) => {
            // Get the position schema (Room node with Position child)
            const positionSchema = position.schema
            if (positionSchema.length === 0) {
                return undefined
            }
            
            const positionRoomNode = positionSchema[0]
            if (!treeNodeTypeguard(isSchemaRoom)(positionRoomNode)) {
                return positionRoomNode
            }
            
            // NOTE: This assumes a simple (non-edit) StandardPosition schema shape. It is probably
            //       in need of tuning for more complex edit scenarios (Remove/Replace with nested Position).
            const roomKey = position._payload.plain.room
            const roomComponent = lookup(roomKey)
            
            // Check if room is parented to this map (explicit or implicit parentage)
            if (roomComponent && options.organization?.isParentContext(roomKey, mapKeyPlain)) {
                // Room is parented to map - get full room schema with all content
                const roomNestedSchema = roomComponent.nestedSchema(lookup, { 
                    ...options, 
                    key: roomKey, 
                    parent: mapKeyPlain 
                })
                
                // Merge position into room schema
                // The position schema has a Position child that needs to be added to the room's children
                const positionChild = positionRoomNode.children.find(treeNodeTypeguard(isSchemaPosition))
                
                if (positionChild) {
                    // Add Position to room's children if not already present
                    const hasPosition = roomNestedSchema.children.some(treeNodeTypeguard(isSchemaPosition))
                    if (!hasPosition) {
                        return {
                            ...roomNestedSchema,
                            children: [
                                positionChild,
                                ...roomNestedSchema.children
                            ]
                        }
                    }
                }
                
                return roomNestedSchema
            } else {
                // Room is not parented to map - use position-only schema
                return positionRoomNode
            }
        }).filter(excludeUndefined)
        
        return {
            data: { tag: 'Map', key: mapKey.key ?? '', uuid: mapKey.universalKey },
            children: [
                ...this.name ? this.name.nestedSchema({ tag: 'Name' }) : [],
                ...this.images,
                ...positionSchemas
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMapPayload()
        returnValue._name = this._name && incoming._name ? this._name.merge(incoming._name) : this._name ?? incoming._name,
        returnValue._images = applyEdits([...this.images, ...incoming.images])
        returnValue._positions = mergeStandardPositionList(this.positions, incoming.positions)
        return returnValue as this
    }

    subset(): this {
        return new StandardMapPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return this.positions.map((position ) => {
            if (position._payload instanceof StandardPositionSimple || position._payload instanceof StandardPositionReplace) {
                return [{ referenceType: 'Position' as const, key: position._payload.room }]
            }
            return []
        }).flat(1)
        // return positionReferenceKeys(this.positions ?? [])
        //     .map((key) => ({ referenceType: 'Position', key }))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMapPayload(this)
        // returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
        returnValue._images = callback(returnValue._images)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMapPayload(this)
        // const mapReference = mapReferenceToFormat(props.mappings, props.mapTo === 'uuid' ? 'universal' : 'key')
        //
        // After refactoring Position as StandardPosition class, we will need to
        // remap those references here
        //
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

    override clone(): StandardMap {
        const returnValue = new StandardMap(this)
        returnValue._payload = new StandardMapPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMap(super.merge(incoming) as StandardMap)
    }

    override withKey(key: string): StandardComponent {
        return new StandardMap(super.withKey(key) as StandardMap)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardMap(super.withUniversalKey(key) as StandardMap)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMap(super.withFileName(key) as StandardMap)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardMap(super.withMapping(mapping) as StandardMap)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardMap(super.withImport(fromAsset) as StandardMap)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardMap(super.withOrigin(origin) as StandardMap)
    }

    override withChild(child: StandardReference): StandardComponent {
        return new StandardMap(super.withChild(child) as StandardMap)
    }


    override withExplicitParent(explicitParent: StandardExplicitParent | undefined): StandardComponent {
        return new StandardMap(super.withExplicitParent(explicitParent) as StandardMap)
    }

}

export default StandardMap

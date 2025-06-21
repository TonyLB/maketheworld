import { excludeUndefined } from "../../lib/lists"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { StandardMapData } from "./dataTypes/map"
import { standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { applyTreeCallbackToNode } from "./utils/mapContents"
import { combineTaggedChildren } from "./utils/merge"
import { ReferenceFormat } from "./utils/references"
import { isSchemaName, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example"
import { ComponentUUID, isSchemaOutputTag, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMap } from "@tonylb/mtw-base/ts/schema/components"
import StandardPosition, { mergeStandardPositionList, StandardPositionReplace, StandardPositionSimple } from "./position"
import { StandardKey } from "./reference"

export class StandardMapPayload implements ComponentConstructorMethods<StandardMapData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
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
        this._name = props.name
        this._images = props.images
        this._positions = props.positions.map((position) => (new StandardPosition(position))).filter(excludeUndefined)
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMap)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const positionsTagTree = tagTree
                .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { match: 'Position' }])
                .prune({ not: { or: [
                    { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { match: 'Position' }
                ]}})
                .reorderedSiblings([['Room', 'Position'], ['If']])
            const imagesTagTree = tagTree.filter({ match: 'Image' })

            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
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
            name: this.name,
            images: this.images,
            positions: this.positions.map((position) => position.toJSON())
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Map', key, uuid: universalKey },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.images,
                ...this.positions.map((position) => position.schema).filter(excludeUndefined).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMapPayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
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
                return [{ referenceType: 'Position' as const, key: position._payload.room.plain }]
            }
            return []
        }).flat(1)
        // return positionReferenceKeys(this.positions ?? [])
        //     .map((key) => ({ referenceType: 'Position', key }))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMapPayload(this)
        returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
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

}

export default StandardMap

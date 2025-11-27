import { excludeUndefined } from "../../lib/lists"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardMessageData } from "./dataTypes/message"
import { childReferenceFactory, ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { AssetUUID, ComponentUUID, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDescription, SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaMessage, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import StandardReference, { ReferenceList, StandardKey } from "./reference"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { StandardReferenceData } from "./dataTypes/reference"
import { deepEqual } from "../../lib/objects"

export class StandardMessagePayload implements ComponentConstructorMethods<StandardMessageData> {
    _description?: StandardRender;
    _rooms: ReferenceList;
    tag = 'Message' as const

    constructor(previous?: StandardMessagePayload) {
        if (previous) {
            this._description = previous._description
            this._rooms = new ReferenceList(previous._rooms)
        }
        else {
            this._rooms = new ReferenceList([])
        }
    }

    fromJSON(props: StandardMessageData) {
        this._description = extractStandardRender(props.description, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
        this._rooms = new ReferenceList(props.rooms?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMessage)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            this._description = extractStandardRender<SchemaDescriptionTag>(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
            this._rooms = new ReferenceList(node.children.filter(wrappedNodeTypeGuard(isSchemaRoom)).map(childReferenceFactory))
            return
        }
        throw new Error('Schema mismatch in StandardMessage constructor')
    }

    get description() { return this._description }
    get rooms() { return this._rooms }

    toJSON(options?: StandardToJSONOptions): Omit<StandardMessageData, 'key' | 'universalKey'> {
        return {
            tag: 'Message',
            description: rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }),
            ...(this.rooms.payload.length ? { rooms: this.rooms.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Message', key, uuid: universalKey },
            children: [
                ...this.rooms.schema,
                ...(this.description?.schema ?? [])
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMessagePayload()
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._rooms = this._rooms.merge(incoming._rooms) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardMessagePayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this._rooms.payload.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMessagePayload(this)
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        // returnValue._rooms = callback(returnValue._rooms)
        return returnValue as this
    }

    remapReferences(props: { mappings: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMessagePayload(this)
        returnValue._rooms = returnValue._rooms.lookup(props.mappings).toFormat(props.mapTo)
        if (returnValue._description) {
            returnValue._description = returnValue._description.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        }
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardMessagePayload(this)
        if (child._payload.plain.tag === 'Room') {
            returnValue._rooms = returnValue._rooms.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child._payload.tag} for StandardMessage`)
        }
        return returnValue as this
    }
}

export class StandardMessage extends componentClassFactory(StandardMessagePayload, 'StandardMessage') {
    get description() { return this._payload.description }
    get rooms() { return this._payload.rooms }

    override clone(): StandardMessage {
        const returnValue = new StandardMessage(this)
        returnValue._payload = new StandardMessagePayload(this._payload)
        return returnValue
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardMessage)) {
            throw new Error('Mismatched component types in diff')
        }
        // Check explicitParent differences separately
        const explicitParentDiff = this.explicitParent?.diff(incoming.explicitParent)
        const hasExplicitParentDiff = explicitParentDiff !== undefined
        const roomsDiff = this.rooms.diff(incoming.rooms) ?? new ReferenceList([])
        if (deepEqual(this._payload.description?.toJSON(), incoming._payload.description?.toJSON()) &&
            !roomsDiff.payload.length &&
            !hasExplicitParentDiff
        ) {
            return undefined
        }
        const base = this.clone()
        base._payload = new StandardMessagePayload()
        base._payload._description = this._payload._description
            ? this._payload._description.diff(incoming._payload._description)
            : incoming._payload._description
        base._payload._rooms = roomsDiff
        // Apply explicitParent diff if it exists (pass pre-computed diff to avoid recalculation)
        this._applyExplicitParentDiffToComponent(base, incoming, explicitParentDiff)
        return base
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardMessage)) {
            return false
        }
        const roomsDiff = this.rooms.diff(incoming.rooms) ?? new ReferenceList([])
        return !(roomsDiff.payload.length) &&
            deepEqual(this.description?.toJSON(), incoming.description?.toJSON())
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMessage(super.merge(incoming) as StandardMessage)
    }

    override withKey(key: string): StandardComponent {
        return new StandardMessage(super.withKey(key) as StandardMessage)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardMessage(super.withUniversalKey(key) as StandardMessage)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMessage(super.withFileName(key) as StandardMessage)
    }

    override withMapping(mapping: StandardKey[]): StandardComponent {
        return new StandardMessage(super.withMapping(mapping) as StandardMessage)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardMessage(super.withImport(fromAsset) as StandardMessage)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardMessage(super.withOrigin(origin) as StandardMessage)
    }
    
    override withChild(child: StandardReference): StandardComponent {
        return new StandardMessage(super.withChild(child) as StandardMessage)
    }

}

export default StandardMessage

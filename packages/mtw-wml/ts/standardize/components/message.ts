import { excludeUndefined } from "../../lib/lists"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { StandardMessageData } from "./dataTypes/message"
import { assureItemInReferenceList, childReferenceFactory, mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { AssetUUID, ComponentUUID, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDescription, SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaMessage, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import StandardReference, { StandardKey } from "./reference"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { StandardReferenceData } from "./dataTypes/reference"

export class StandardMessagePayload implements ComponentConstructorMethods<StandardMessageData> {
    _description?: StandardRender;
    _rooms: StandardReference[] = [];
    tag = 'Message' as const

    constructor(previous?: StandardMessagePayload) {
        if (previous) {
            this._description = previous._description
            this._rooms = [...previous._rooms]
        }
    }

    fromJSON(props: StandardMessageData) {
        this._description = extractStandardRender(props.description, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
        this._rooms = props.rooms?.map((reference) => (new StandardReference(reference))) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMessage)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            this._description = extractStandardRender<SchemaDescriptionTag>(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            this._rooms = roomTagTree.tree.filter(wrappedNodeTypeGuard(isSchemaRoom)).map((node => (childReferenceFactory([node]))))
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
            rooms: this.rooms.map((reference) => (reference.toJSON() as StandardReferenceData)),
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Message', key, uuid: universalKey },
            children: [
                ...this.rooms.map((reference) => (reference.schema)).flat(1),
                ...(this.description?.schema ?? [])
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMessagePayload()
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._rooms = mergeUniqueReferences(this._rooms, incoming._rooms)
        return returnValue as this
    }

    subset(): this {
        return new StandardMessagePayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this._rooms.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain }))
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
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._rooms = returnValue._rooms.map(mapReference)
        if (returnValue._description) {
            returnValue._description = returnValue._description.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        }
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardMessagePayload(this)
        if (child._payload.plain.tag === 'Room') {
            returnValue._rooms = assureItemInReferenceList(returnValue._rooms, child)
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
    
}

export default StandardMessage

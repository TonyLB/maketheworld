/**
 * WML Message components (`<Message>`) are supported for authoring, standardization, and tooling.
 * Ephemera does not implement runtime delivery of Message components to players (no MESSAGE# perception path).
 */
import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { AssureReferencesResult, componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardMessageData } from "./dataTypes/message"
import { ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { StandardToJSONOptions } from "./baseClasses"
import { AssetUUID, ComponentUUID, SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDescription, SchemaDescriptionTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaMessage } from "@tonylb/mtw-base/ts/schema/components"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { ReferenceList } from "./reference"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardReferenceData } from "./dataTypes/reference"
import { deepEqual } from "../../lib/objects"
import { StandardExplicitParent } from "../explicit"
import { StandardLiteral } from "../literal"
import {
    processWithConsumers,
    StandardizeConsumerInline,
    StandardizeConsumerReferenceList,
    StandardizeConsumerRender,
    StandardizeConsumerStandardLiteral,
} from "./fromSchemaPipeline"

export class StandardMessagePayload implements ComponentConstructorMethods<StandardMessageData> {
    _shortName?: StandardLiteral;
    _description?: StandardRender;
    _rooms: ReferenceList;
    tag = 'Message' as const

    constructor(previous?: StandardMessagePayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._description = previous._description
            this._rooms = new ReferenceList(previous._rooms)
        }
        else {
            this._rooms = new ReferenceList([])
        }
    }

    fromJSON(props: StandardMessageData) {
        this._shortName = props.shortName ? new StandardLiteral(props.shortName, { tag: 'ShortName' }) : undefined
        this._description = props.description ? new StandardRender(props.description, { tag: 'Description', nodeTypeGuard: isSchemaDescription, errorMessage: 'Schema mismatch in StandardMessage constructor' }) : undefined
        this._rooms = new ReferenceList(props.rooms?.map((reference) => (new StandardReference(reference))) ?? [])
    }

    fromSchema(node: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> {
        if (treeNodeTypeguard(isSchemaMessage)(node)) {
            const consumers = [
                new StandardizeConsumerStandardLiteral(this, {
                    tag: "ShortName",
                    update(literal) {
                        this._shortName = literal
                    },
                }),
                new StandardizeConsumerRender<StandardMessagePayload, SchemaDescriptionTag>(this, {
                    tag: "Description",
                    nodeTypeGuard: isSchemaDescription,
                    errorMessage: 'Schema mismatch in StandardMessage constructor',
                    update(render) {
                        this._description = render
                    },
                }),
                new StandardizeConsumerReferenceList(this, {
                    tag: "Room",
                    update(list) {
                        this._rooms = list
                    },
                }),
                new StandardizeConsumerInline(),
            ]
            const returnRemainder = processWithConsumers(this, consumers, node.children)
            return returnRemainder
        }
        throw new Error('Schema mismatch in StandardMessage constructor')
    }

    get shortName() { return this._shortName }
    get description() { return this._description }
    get rooms() { return this._rooms }

    toJSON(options?: StandardToJSONOptions): Omit<StandardMessageData, 'key' | 'universalKey'> {
        return {
            tag: 'Message',
            ...(this._shortName ? { shortName: this._shortName.toJSON() } : {}),
            description: this._description?.nestedSchema({ tag: 'Description' })?.[0] as StandardMessageData['description'],
            ...(this.rooms.payload.length ? { rooms: this.rooms.toJSON() } : {})
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        // Look up references using mappings to resolve universalKeys to local keys, then format to 'key' format
        // (structural reference, not content)
        const roomsFormatted = this.rooms.toFormat('key', mappings)
        const roomsSchema = roomsFormatted.schema
        
        return {
            data: { tag: 'Message', key, uuid: universalKey },
            children: [
                ...(this._shortName ? this._shortName.nestedSchema() : []),
                ...roomsSchema,
                ...(this.description?.nestedSchema({ tag: 'Description', mappings }) ?? [])
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMessagePayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._rooms = this._rooms.merge(incoming._rooms) ?? new ReferenceList([])
        return returnValue as this
    }

    subset(): this {
        return new StandardMessagePayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return [
            ...this._rooms.payload.map((reference) => ({ referenceType: 'Direct' as const, reference }))
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

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMessagePayload(this)
        returnValue._rooms = returnValue._rooms.toFormat(props.mapTo, props.mappings)
        if (returnValue._description) {
            returnValue._description = returnValue._description.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        }
        return returnValue as this
    }

    withChild(child: StandardReference): this {
        const returnValue = new StandardMessagePayload(this)
        if (child.tag === 'Room') {
            returnValue._rooms = returnValue._rooms.assureItem(child)
        }
        else {
            throw new Error(`Invalid child type ${child.tag} for StandardMessage`)
        }
        return returnValue as this
    }

    isEmpty(): boolean {
        // A message is empty if it has no description and no rooms
        const hasDescription = Boolean(this._description)
        const hasRooms = this._rooms.payload.length > 0
        return !(hasDescription || hasRooms)
    }

    invert(): this {
        const returnValue = new StandardMessagePayload()
        // Invert description if it exists (StandardRender has invert())
        returnValue._description = this._description ? this._description.invert() : undefined
        // Invert rooms ReferenceList
        returnValue._rooms = this._rooms.invert()
        return returnValue as this
    }

    assureReferences(children: StandardReference[]): AssureReferencesResult<this> {
        const BUCKET_TAGS = ['Room'] as const
        const bucketChildren = children.filter(c => BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))
        const remainder = children.filter(c => !BUCKET_TAGS.includes(c.tag as (typeof BUCKET_TAGS)[number]))

        const returnValue = new StandardMessagePayload(this)
        const roomReferences = new ReferenceList(
            bucketChildren.filter(child => child.tag === 'Room').map(child => child.withRef(0))
        )
        returnValue._rooms = this._rooms.merge(roomReferences, { cleanEmptyReferences: false }) ?? this._rooms

        return {
            payload: returnValue as this,
            inlineRemainder: remainder.map(c => c.withRef(0))
        }
    }

    removeReferences(references: StandardReference[]): this {
        const returnValue = new StandardMessagePayload(this)
        
        // Filter reference list by removing items that match any reference in the input
        returnValue._rooms = this._rooms.filter(
            item => !references.some(ref => item.sameKey(ref))
        )
        
        return returnValue as this
    }
}

export class StandardMessage extends componentClassFactory(StandardMessagePayload, 'StandardMessage') {
    get shortName() { return this._payload.shortName }
    get description() { return this._payload.description }
    get rooms() { return this._payload.rooms }

    override _wrap(instance: StandardComponent): this {
        return new StandardMessage(instance as StandardMessage) as this
    }

    override clone(): StandardMessage {
        const returnValue = new StandardMessage(this)
        returnValue._payload = new StandardMessagePayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardMessage)) {
            return false
        }
        const roomsDiff = this.rooms.diff(incoming.rooms) ?? new ReferenceList([])
        return !(roomsDiff.payload.length) &&
            deepEqual(this.shortName?.toJSON(), incoming.shortName?.toJSON()) &&
            deepEqual(this.description?.toJSON(), incoming.description?.toJSON())
    }

}

export default StandardMessage

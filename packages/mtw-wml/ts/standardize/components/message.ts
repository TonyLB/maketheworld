import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaMessage, isSchemaOutputTag, SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardMessage } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardMessageData } from "./dataTypes/message"
import { editWrap } from "./editable"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMessage extends ndjsonWrap(editWrap(class StandardMessage extends StandardComponentAbstract implements ComponentInterface {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _rooms: GenericTree<SchemaTag>;
    tag = 'Message' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardMessage(payload)) {
            this._description = payload.description
            this._rooms = payload.rooms
        }
        else if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaMessage(data)) {
                throw new Error('Type mismatch in StandardMessage constructor')
            }
            const tagTree = new SchemaTagTree(payload.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            this._rooms = roomTagTree.tree
        }
        else {
            throw new Error('Type mismatch in StandardMessage constructor')
        }
    }

    get description() { return this._description }
    get rooms() { return this._rooms }

    override toJSON(): StandardMessageData {
        return {
            key: this.key,
            tag: 'Message',
            description: this.description,
            rooms: this.rooms
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Message', key: this.key },
            children: [
                ...this.rooms,
                ...[this.description].filter(excludeUndefined).map(({ children }) => (children)).flat(1),
            ]
        }
    }

    override clone(): this {
        return new StandardMessage(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardMessage)) {
            throw new Error('Source mismatch in StandardMessage merge')
        }
        const returnValue = this.clone()
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        return returnValue
    }
}, 'StandardMessage'), 'StandardMessage'){}

export default StandardMessage

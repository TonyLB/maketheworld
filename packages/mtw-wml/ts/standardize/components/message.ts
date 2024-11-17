import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaMessage, isSchemaOutputTag, SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardMessage } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardMessageData } from "./dataTypes/message"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMessage extends StandardComponentAbstract implements ComponentInterface {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _rooms: GenericTree<SchemaTag>;
    _match?: StandardMessage;
    tag = 'Message' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardMessage(match)
        }
        if (isSchemaTreeNode(payload)) {
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
            if (!isStandardMessage(payload)) {
                throw new Error('Type mismatch in StandardMessage constructor')
            }
            this._description = payload.description
            this._rooms = payload.rooms
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get description() { return this._description }
    get rooms() { return this._rooms }

    override toJSON(): StandardMessageData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardMessage, StandardMessageData>(this, (value) => ({
            key: value.key,
            tag: 'Message',
            description: value.description,
            rooms: value.rooms
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardMessage) => ({
            data: { tag: 'Message', key: value.key },
            children: [
                ...value.rooms,
                ...[value.description].filter(excludeUndefined).map(({ children }) => (children)).flat(1),
            ]
        }))
    }

    override clone(): this {
        return new StandardMessage(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardMessage)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardMessage>(this, incoming, StandardMessage, (base, incoming) => {
            const args: StandardMessageData = {
                key: base.key,
                tag: 'Message',
                description: combineTaggedChildren(base.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>,
                rooms: applyEdits([...base.rooms, ...incoming.rooms])
            }
            return new StandardMessage(args)
        }) as this | undefined
    }
}

export default StandardMessage

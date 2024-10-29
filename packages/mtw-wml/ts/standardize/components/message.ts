import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaName, isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardMessageData } from "./dataTypes/message"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMessage extends StandardComponentAbstract {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _rooms: GenericTree<SchemaTag>;
    tag = 'Message' as const
    constructor(args: StandardMessageData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const tagTree = new SchemaTagTree(args.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            this._rooms = roomTagTree.tree
        }
        else {
            this._description = args.description
            this._rooms = args.rooms
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

    override merge(incoming: StandardComponentAbstract): StandardMessage {
        if (!(incoming instanceof StandardMessage)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardMessageData = {
            key: this.key,
            tag: 'Message',
            description: combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>,
            rooms: applyEdits([...this.rooms, ...incoming.rooms])
        }
        return new StandardMessage(args)
    }
}

export default StandardMessage

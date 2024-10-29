import { isSchemaMoment, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardMomentData } from "./dataTypes/moment"
import { isSchemaTreeNode } from "./utils"

export class StandardMoment extends StandardComponentAbstract {
    _messages: GenericTree<SchemaTag>;
    tag = 'Moment' as const
    constructor(args: StandardMomentData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaMoment(args.data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            const messagesTagTree = new SchemaTagTree(args.children).filter({ match: 'Message' })
            this._messages = messagesTagTree.tree
        }
        else {
            this._messages = args.messages
        }
    }

    get messages() { return this._messages }

    override toJSON(): StandardMomentData {
        return {
            key: this.key,
            tag: 'Moment',
            messages: this._messages
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key: this.key },
            children: this.messages
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardMoment {
        if (!(incoming instanceof StandardMoment)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardMomentData = {
            key: this.key,
            tag: 'Moment',
            messages: applyEdits([...this.messages, ...incoming.messages])
        }
        return new StandardMoment(args)
    }
}

export default StandardMoment

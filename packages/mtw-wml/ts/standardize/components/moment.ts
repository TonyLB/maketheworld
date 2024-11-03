import { isSchemaMoment, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { isStandardMoment, StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardMomentData } from "./dataTypes/moment"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardMoment extends StandardComponentAbstract {
    _messages: GenericTree<SchemaTag>;
    _match?: StandardMoment;
    tag = 'Moment' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardMoment(match)
        }
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaMoment(payload.data)) {
                throw new Error('Type mismatch in StandardMoment constructor')
            }
            const messagesTagTree = new SchemaTagTree(payload.children).filter({ match: 'Message' })
            this._messages = messagesTagTree.tree
        }
        else {
            if (!isStandardMoment(payload)) {
                throw new Error('Type mismatch in StandardMoment constructor')
            }
            this._messages = payload.messages
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get messages() { return this._messages }

    override toJSON(): StandardMomentData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardMoment, StandardMomentData>(this, (value) => ({
            key: value.key,
            tag: 'Moment',
            messages: value._messages
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardMoment) => ({
            data: { tag: 'Moment', key: value.key },
            children: value.messages
        }))
    }

    override merge(incoming: StandardComponentAbstract): StandardMoment | undefined {
        if (!(incoming instanceof StandardMoment)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardMoment>(this, incoming, StandardMoment, (base, incoming) => {
            const args: StandardMomentData = {
                key: base.key,
                tag: 'Moment',
                messages: applyEdits([...base.messages, ...incoming.messages])
            }
            return new StandardMoment(args)
        })
    }
}

export default StandardMoment

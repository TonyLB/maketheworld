import { isSchemaMoment, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { isStandardMoment } from "./dataTypes"
import { StandardMomentData } from "./dataTypes/moment"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardMoment extends editWrap(class StandardMoment extends StandardComponentAbstract implements ComponentInterface {
    _messages: GenericTree<SchemaTag>;
    tag = 'Moment' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            this._messages = []
            return
        }
        if (isStandardMoment(payload)) {
            this._messages = payload.messages
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaMoment)(node)) {
                const messagesTagTree = new SchemaTagTree(node.children).filter({ match: 'Message' })
                this._messages = messagesTagTree.tree
                return
            }
        }
        throw new Error('Type mismatch in StandardMoment constructor')
    }

    get messages() { return this._messages }

    override toJSON(): StandardMomentData {
        return {
            ...super.toJSON(),
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

    override clone(): this {
        return new StandardMoment(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardMoment)) {
            throw new Error('Source mismatch in StandardMoment merge')
        }
        const returnValue = this.clone()
        returnValue._messages = applyEdits([...this.messages, ...incoming.messages])
        return returnValue
    }
}, 'StandardMoment'){}

export default StandardMoment

import { isSchemaMoment, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { isStandardMoment } from "./dataTypes"
import { StandardMomentData } from "./dataTypes/moment"
import { editWrap } from "./editable"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode } from "./utils"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData> {
    _messages: GenericTree<SchemaTag> = [];
    tag = 'Moment' as const

    fromJSON(props: StandardMomentData) {
        this._messages = props.messages
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMoment)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const messageTagTree = tagTree.filter({ match: 'Message' }).prune({ not: { or: [{ match: 'Message' }, { before: { match: 'Message' } }] } })
            this._messages = messageTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get messages() { return this._messages }

    toJSON(): Omit<StandardMomentData, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            messages: this.messages
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key },
            children: this.messages
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._messages = applyEdits([...this.messages, ...incoming.messages])
        return returnValue as this
    }
}

export class StandardMoment extends componentClassFactory(StandardMomentPayload, 'StandardMoment') {
    get messages() { return this._payload.messages }
}

export class StandardMomentLegacy extends ndjsonWrap(editWrap(class StandardMoment extends StandardComponentAbstract implements ComponentInterface {
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
}, 'StandardMoment')){}

export default StandardMoment

import { isSchemaMoment, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardMomentData } from "./dataTypes/moment"

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

export default StandardMoment

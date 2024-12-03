import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardAction } from "./dataTypes"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardActionData } from "./dataTypes/action"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"
import { ndjsonWrap } from "./ndjson"
import { componentClassFactory, ComponentConstructorMethods } from "./component"

export class StandardActionPayload implements ComponentConstructorMethods<StandardActionData> {
    _src?: string;
    _dependencies?: string[];
    tag = 'Action' as const;

    fromJSON(props: StandardActionData) {
        this._src = props.src
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaAction)(node)) {
            this._src = node.data.src
            return
        }
        throw new Error('Schema mismatch in StandardAction constructor')
    }

    get src() { return this._src ?? '' }
    get dependencies() { return this._dependencies }

    toJSON(): Omit<StandardActionData, 'key' | 'universalKey'> {
        return {
            tag: 'Action',
            src: this.src
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardActionPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }
}

export class StandardActionRefactored extends componentClassFactory(StandardActionPayload, 'StandardAction') {
    get src() { return this._payload.src }
    get dependencies() { return this._payload.dependencies }
}

export class StandardAction extends ndjsonWrap(editWrap(class StandardAction extends StandardComponentAbstract implements ComponentInterface {
    _src?: string;
    _dependencies?: string[];
    tag = 'Action' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            this._src = ''
            return
        }
        if (isStandardAction(payload)) {
            this._src = payload.src
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaAction)(node)) {
                const { data } = node
                this._src = data.src
                return
            }
        }
        throw new Error('Type mismatch in StandardAction constructor')
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardActionData {
        return {
            ...super.toJSON(),
            tag: 'Action',
            src: this.src ?? ''
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key: this.key, src: this.src ?? '' },
            children: []
        }
    }

    override clone(): this {
        return new StandardAction(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardAction)) {
            throw new Error('Source mismatch in StandardAction merge')
        }
        const returnValue = this.clone()
        returnValue._src = incoming.src ?? this.src
        return returnValue
    }
}, 'StandardAction')){}

export default StandardAction

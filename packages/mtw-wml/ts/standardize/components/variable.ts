import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { isStandardVariable } from "./dataTypes"
import { StandardVariableData } from "./dataTypes/variable"
import { editWrap } from "./editable"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode } from "./utils"

export class StandardVariablePayload implements ComponentConstructorMethods<StandardVariableData> {
    _default?: string;
    tag = 'Variable' as const;

    fromJSON(props: StandardVariableData) {
        this._default = props.default
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaVariable)(node)) {
            this._default = node.data.default
            return
        }
        throw new Error('Schema mismatch in StandardVariable constructor')
    }

    get default() { return this._default ?? '' }

    toJSON(): Omit<StandardVariableData, 'key' | 'universalKey'> {
        return {
            tag: 'Variable',
            default: this.default
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Variable', key, default: this.default },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardVariablePayload()
        returnValue._default = incoming.default ?? this.default
        return returnValue as this
    }
}

export class StandardActionRefactored extends componentClassFactory(StandardVariablePayload, 'StandardVariable') {
    get default() { return this._payload.default }
}

export class StandardVariable extends ndjsonWrap(editWrap(class StandardVariable extends StandardComponentAbstract implements ComponentInterface {
    _default?: string;
    tag = 'Variable' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            return
        }
        else if (isStandardVariable(payload)) {
            this._default = payload.default
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaVariable)(node)) {
                const { data } = node
                this._default = data.default
                return
            }
        }
        throw new Error('Type mismatch in StandardAction constructor')
    }

    get default() { return this._default }

    override toJSON(): StandardVariableData {
        return {
            ...super.toJSON(),
            tag: 'Variable',
            default: this.default ?? ''
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Variable', key: this.key, default: this.default },
            children: []
        }
    }

    override clone(): this {
        return new StandardVariable(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardVariable)) {
            throw new Error('Source mismatch in StandardVariable merge')
        }
        const returnValue = this.clone()
        returnValue._default = incoming.default ?? this.default ?? ''
        return returnValue
    }
}, 'StandardVariable')){}

export default StandardVariable

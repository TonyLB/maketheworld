import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { isStandardVariable } from "./dataTypes"
import { StandardVariableData } from "./dataTypes/variable"
import { editWrap } from "./editable"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode } from "./utils"

export class StandardVariable extends ndjsonWrap(editWrap(class StandardVariable extends StandardComponentAbstract implements ComponentInterface {
    _default?: string;
    tag = 'Variable' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardVariable(payload)) {
            this._default = payload.default
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaVariable)(payload)) {
            const { data } = payload
            this._default = data.default
        }
        else {
            throw new Error('Type mismatch in StandardAction constructor')
        }
    }

    get default() { return this._default }

    override toJSON(): StandardVariableData {
        return {
            key: this.key,
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
}, 'StandardVariable'), 'StandardVariable'){}

export default StandardVariable

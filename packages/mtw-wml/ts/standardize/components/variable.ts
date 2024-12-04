import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardVariableData } from "./dataTypes/variable"

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

export class StandardVariable extends componentClassFactory(StandardVariablePayload, 'StandardVariable') {
    get default() { return this._payload.default }
}

export default StandardVariable

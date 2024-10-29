import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardVariableData } from "./dataTypes/variable"
import { isSchemaTreeNode } from "./utils"

export class StandardVariable extends StandardComponentAbstract {
    _default?: string;
    tag = 'Variable' as const
    constructor(args: StandardVariableData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!isSchemaVariable(data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            this._default = data.default
        }
        else {
            this._default = args.default
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

    override merge(incoming: StandardComponentAbstract): StandardVariable {
        if (!(incoming instanceof StandardVariable)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardVariableData = {
            key: this.key,
            tag: 'Variable',
            default: incoming.default ?? this.default ?? ''
        }
        return new StandardVariable(args)
    }
}

export default StandardVariable

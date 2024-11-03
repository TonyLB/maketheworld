import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { isStandardVariable, StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardVariableData } from "./dataTypes/variable"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardVariable extends StandardComponentAbstract {
    _default?: string;
    _match?: StandardVariable;
    tag = 'Variable' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardVariable(match)
        }
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaVariable(data)) {
                throw new Error('Type mismatch in StandardVariable constructor')
            }
            this._default = data.default
        }
        else {
            if (!isStandardVariable(payload)) {
                throw new Error('Type mismatch in StandardAction constructor')
            }
            this._default = payload.default
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get default() { return this._default }

    override toJSON(): StandardVariableData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardVariable, StandardVariableData>(this, (value) => ({
            key: value.key,
            tag: 'Variable',
            default: value.default ?? ''
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardVariable) => ({
            data: { tag: 'Variable', key: value.key, default: value.default },
            children: []
        }))
    }

    override merge(incoming: StandardComponentAbstract): StandardVariable | undefined {
        if (!(incoming instanceof StandardVariable)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardVariable>(this, incoming, StandardVariable, (base, incoming) => {
            const args: StandardVariableData = {
                key: base.key,
                tag: 'Variable',
                default: incoming.default ?? base.default ?? ''
            }
            return new StandardVariable(args)
        })
    }
}

export default StandardVariable

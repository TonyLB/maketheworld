import { isSchemaComputed, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardComputed, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardComputedData } from "./dataTypes/computed"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardComputed extends StandardComponentAbstract implements ComponentInterface {
    _src?: string;
    _dependencies?: string[];
    _match?: StandardComputed;
    tag = 'Computed' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardComputed(match)
        }
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaComputed(data)) {
                throw new Error('Type mismatch in StandardComputed constructor')
            }
            this._src = data.src
            this._dependencies = data.dependencies
        }
        else {
            if (!isStandardComputed(payload)) {
                throw new Error('Type mismatch in StandardComputed constructor')
            }
            this._src = payload.src
            this._dependencies = payload.dependencies
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardComputedData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardComputed, StandardComputedData>(this, (value) => ({
            key: value.key,
            tag: 'Computed',
            src: value.src ?? '',
            dependencies: value.dependencies
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardComputed) => ({
            data: { tag: 'Computed', key: value.key, src: value.src ?? '', dependencies: value.dependencies },
            children: []
        }))
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardComputed)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardComputed>(this, incoming, StandardComputed, (base, incoming) => {
            const args: StandardComputedData = {
                key: base.key,
                tag: 'Computed',
                src: incoming.src ?? base.src ?? '',
                dependencies: incoming.dependencies ?? base.dependencies
            }
            return new StandardComputed(args)
        }) as this | undefined
    }
}

export default StandardComputed

import { isSchemaComputed, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardComputed, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardComputedData } from "./dataTypes/computed"
import { editWrap, unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardComputed extends editWrap(class StandardComputed extends StandardComponentAbstract implements ComponentInterface {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardComputed(payload)) {
            this._src = payload.src
            this._dependencies = payload.dependencies
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaComputed)(payload)) {
            const { data } = payload
            this._src = data.src
            this._dependencies = data.dependencies
        }
        else {
            throw new Error('Type mismatch in StandardComputed constructor')
        }
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardComputedData {
        return {
            key: this.key,
            tag: 'Computed',
            src: this.src ?? '',
            dependencies: this.dependencies
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Computed', key: this.key, src: this.src ?? '', dependencies: this.dependencies },
            children: []
        }
    }

    override clone(): this {
        return new StandardComputed(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardComputed)) {
            throw new Error('Source mismatch in StandardComputed merge')
        }
        const returnValue = this.clone()
        returnValue._src = incoming.src ?? this.src
        returnValue._dependencies = incoming._dependencies ?? this._dependencies
        return returnValue
    }
}, 'StandardComputed'){}

export default StandardComputed

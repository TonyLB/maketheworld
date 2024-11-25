import { isSchemaComputed, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardComputed } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardComputedData } from "./dataTypes/computed"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardComputed extends editWrap(class StandardComputed extends StandardComponentAbstract implements ComponentInterface {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload) )) {
            this._src = ''
            return
        }
        if (isStandardComputed(payload)) {
            this._src = payload.src
            this._dependencies = payload.dependencies
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaComputed)(node)) {
                const { data } = node
                this._src = data.src
                this._dependencies = data.dependencies
                return
            }
        }
        throw new Error('Type mismatch in StandardComputed constructor')
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardComputedData {
        return {
            ...super.toJSON(),
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

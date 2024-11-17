import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardAction } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardActionData } from "./dataTypes/action"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardAction extends editWrap(class StandardAction extends StandardComponentAbstract implements ComponentInterface {
    _src?: string;
    _dependencies?: string[];
    tag = 'Action' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardAction(payload)) {
            this._src = payload.src
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaAction)(payload)) {
            const { data } = payload
            this._src = data.src
        }
        else {
            throw new Error('Type mismatch in StandardAction constructor')
        }
    }

    get src() { return this._src }
    get dependencies() { return this._dependencies }

    override toJSON(): StandardActionData {
        return {
            key: this.key,
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
}, 'StandardAction'){}

export default StandardAction

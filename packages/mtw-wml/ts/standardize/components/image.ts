import { isSchemaImage, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { isStandardImage } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardImageData } from "./dataTypes/image"
import { editWrap } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardImage extends editWrap(class StandardImage extends StandardComponentAbstract implements ComponentInterface {
    tag = 'Image' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardImage(payload)) {
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaImage)(payload)) {
        }
        else {
            throw new Error('Type mismatch in StandardImage constructor')
        }
    }

    override toJSON(): StandardImageData {
        return {
            key: this.key,
            tag: 'Image'
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Image', key: this.key },
            children: []
        }
    }

    override clone(): this {
        return new StandardImage(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardImage)) {
            throw new Error('Source mismatch in StandardAction merge')
        }
        const returnValue = this.clone()
        return returnValue
    }
}, 'StandardImge'){}

export default StandardImage

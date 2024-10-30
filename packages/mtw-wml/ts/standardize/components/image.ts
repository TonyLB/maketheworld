import { isSchemaAction, isSchemaImage, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardImageData } from "./dataTypes/image"
import { isSchemaTreeNode } from "./utils"

export class StandardImage extends StandardComponentAbstract {
    tag = 'Image' as const
    constructor(args: StandardImageData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const { data } = args
            if (!isSchemaImage(data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
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

    override merge(incoming: StandardComponentAbstract): StandardImage {
        if (!(incoming instanceof StandardImage)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardImageData = {
            key: this.key,
            tag: 'Image'
        }
        return new StandardImage(args)
    }
}

export default StandardImage

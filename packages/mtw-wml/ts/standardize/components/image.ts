import { isSchemaImage, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { isStandardImage, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardImageData } from "./dataTypes/image"
import { unwrapConstructorArgs, wrapJSON, wrapSchema } from "./editable"
import { isSchemaTreeNode } from "./utils"

export class StandardImage extends StandardComponentAbstract {
    _match?: StandardImage;
    tag = 'Image' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardImage(match)
        }
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaImage(data)) {
                throw new Error('Type mismatch in StandardImage constructor')
            }
        }
        else {
            if (!isStandardImage(payload)) {
                throw new Error('Type mismatch in StandardImage constructor')
            }
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    override toJSON(): StandardImageData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardImage, StandardImageData>(this, (value) => ({
            key: value.key,
            tag: 'Image'
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardImage) => ({
            data: { tag: 'Image', key: value.key },
            children: []
        }))
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

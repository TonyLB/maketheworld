import { isSchemaImage, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardImageData } from "./dataTypes/image"

export class StandardImagePayload implements ComponentConstructorMethods<StandardImageData> {
    tag = 'Image' as const;

    fromJSON(props: StandardImageData) {
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaImage)(node)) {
            return
        }
        throw new Error('Schema mismatch in StandardImage constructor')
    }

    toJSON(): Omit<StandardImageData, 'key' | 'universalKey'> {
        return {
            tag: 'Image'
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Image', key },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardImagePayload()
        return returnValue as this
    }
}

export class StandardImage extends componentClassFactory(StandardImagePayload, 'StandardImage') {}

export default StandardImage

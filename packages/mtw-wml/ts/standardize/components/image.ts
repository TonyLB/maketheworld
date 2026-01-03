import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image";
import StandardReference from "./reference";
import { StandardKey } from "../keys/key";
import { StandardExplicitParent } from "../explicit";

export class StandardImagePayload implements ComponentConstructorMethods<StandardImageData> {
    tag = 'Image' as const;

    constructor(previous?: StandardImagePayload) {
    }

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

    subset(): this {
        return new StandardImagePayload() as this
    }

    referencedKeys(): StandardComponentReferenceKey[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    isEmpty(): boolean {
        // An image component has no content fields, so it's always considered empty
        // (though the component itself may still exist for reference purposes)
        return true
    }
}

export class StandardImage extends componentClassFactory(StandardImagePayload, 'StandardImage') {

    override _wrap(instance: StandardComponent): this {
        return new StandardImage(instance as StandardImage) as this
    }

    override clone(): StandardImage {
        const returnValue = new StandardImage(this)
        returnValue._payload = new StandardImagePayload(this._payload)
        return returnValue
    }

}

export default StandardImage

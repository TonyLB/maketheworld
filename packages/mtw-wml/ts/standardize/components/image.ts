import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image";
import StandardReference, { StandardKey } from "./reference";
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

    override clone(): StandardImage {
        const returnValue = new StandardImage(this)
        returnValue._payload = new StandardImagePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardImage(super.merge(incoming) as StandardImage)
    }

    override withKey(key: string): StandardComponent {
        return new StandardImage(super.withKey(key) as StandardImage)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardImage(super.withUniversalKey(key) as StandardImage)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardImage(super.withFileName(key) as StandardImage)
    }

    override withMapping(mapping: StandardReference[]): StandardComponent {
        return new StandardImage(super.withMapping(mapping) as StandardImage)
    }

    override withImport(fromAsset: AssetUUID): StandardComponent {
        return new StandardImage(super.withImport(fromAsset) as StandardImage)
    }

    override withOrigin(origin: AssetUUID[]): StandardComponent {
        return new StandardImage(super.withOrigin(origin) as StandardImage)
    }
    
    override withChild(child: StandardReference): StandardComponent {
        return new StandardImage(super.withChild(child) as StandardImage)
    }


    override withExplicitParent(explicitParent: StandardExplicitParent | undefined): StandardComponent {
        return new StandardImage(super.withExplicitParent(explicitParent) as StandardImage)
    }

}

export default StandardImage

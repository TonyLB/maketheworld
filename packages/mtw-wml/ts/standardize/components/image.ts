import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardExportItem, StandardImportItem } from "./metaData";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image";
import { StandardKey } from "./reference";

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

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
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

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardImage(super.withImport(importData) as StandardImage)
    }

}

export default StandardImage

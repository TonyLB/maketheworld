import { isSchemaWithKey, SchemaTag, SchemaWithKey } from "../../schema/baseClasses"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { defaultComponentFromTag } from "../baseClasses";
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentData, StandardComponentNonEditData, StandardReferenceData } from "./dataTypes"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardExportItem, StandardImportItem } from "./metaData";

export class StandardReferencePayload implements ComponentConstructorMethods<StandardReferenceData> {
    tag: SchemaWithKey["tag"] = 'Room';

    constructor(previous?: StandardReferencePayload) {
        if (previous) {
            this.tag = previous.tag
        }
    }

    fromJSON(props: StandardReferenceData) {
        this.tag = props.tag
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaWithKey)(node)) {
            this.tag = node.data.tag
            return
        }
        throw new Error('Schema mismatch in StandardReference constructor')
    }

    toJSON(): Omit<StandardComponentNonEditData, 'key' | 'universalKey'> {
        const { key, ...rest } = defaultComponentFromTag(this.tag, '')
        return rest
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        if (this.tag === 'Asset' || this.tag === 'Story' || this.tag === 'Character') {
            throw new Error('Character, Asset and Story references are not allowed in StandardReference')
        }
        return {
            data: { tag: this.tag, key } as SchemaTag,
            children: []
        }
    }

    merge(incoming: this): this {
        return this
    }
    
    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardReference extends componentClassFactory(StandardReferencePayload, 'StandardReference') {

    override clone(): StandardReference {
        const returnValue = new StandardReference(this)
        returnValue._payload = new StandardReferencePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardReference(super.merge(incoming) as StandardReference)
    }

    override withKey(key: string): StandardComponent {
        return new StandardReference(super.withKey(key) as StandardReference)
    }
    
    override withUniversalKey(key: string): StandardComponent {
        return new StandardReference(super.withUniversalKey(key) as StandardReference)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardReference(super.withFileName(key) as StandardReference)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardReference(super.withImport(importData) as StandardReference)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardReference(super.withExport(exportData) as StandardReference)
    }

}

export default StandardReference

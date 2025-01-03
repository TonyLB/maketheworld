import { isSchemaFeature, isSchemaWithKey, SchemaFeatureTag, SchemaTag, SchemaWithKey } from "../../schema/baseClasses"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { defaultComponentFromTag } from "../baseClasses";
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { isStandardFeature, StandardComponentData, StandardComponentNonEditData, StandardReferenceData } from "./dataTypes"
import { StandardFeatureData } from "./dataTypes/feature";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardExportItem, StandardImportItem } from "./metaData";

export class StandardReferencePayload implements ComponentConstructorMethods<StandardReferenceData> {
    tag: SchemaWithKey["tag"] = 'Room';
    _global?: boolean;

    constructor(previous?: StandardReferencePayload) {
        if (previous) {
            this.tag = previous.tag
            this._global = previous.global
        }
    }

    fromJSON(props: StandardReferenceData) {
        this.tag = props.tag
        this._global = props.global
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            this._global = node.data.global
        }
        if (treeNodeTypeguard(isSchemaWithKey)(node)) {
            this.tag = node.data.tag
            return
        }
        throw new Error('Schema mismatch in StandardReference constructor')
    }

    get global() { return this._global }

    toJSON(): Omit<StandardComponentNonEditData, 'key' | 'universalKey'> {
        const defaultTag = defaultComponentFromTag(this.tag, '')
        const { key, ...rest } = defaultTag
        if (isStandardFeature(defaultTag)) {
            return { ...rest, global: this._global } as Omit<StandardFeatureData, 'key' | 'universalKey'>
        }
        return rest
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        if (this.tag === 'Asset' || this.tag === 'Story' || this.tag === 'Character') {
            throw new Error('Character, Asset and Story references are not allowed in StandardReference')
        }
        if (this.tag === 'Feature') {
            return {
                data: { tag: this.tag, global: this._global, key } as SchemaFeatureTag,
                children: []
            }
        }
        return {
            data: { tag: this.tag, key } as SchemaTag,
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardReferencePayload(this)
        if (incoming.global) {
            returnValue._global = true
        }
        return returnValue as this
    }
    
    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardReference extends componentClassFactory(StandardReferencePayload, 'StandardReference') {

    override get global() { return this._payload.global }

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

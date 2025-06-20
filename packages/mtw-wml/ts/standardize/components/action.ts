import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardActionData } from "./dataTypes/action"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardExportItem, StandardImportItem } from "./metaData";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaAction } from "@tonylb/mtw-base/ts/schema/computation";
import { StandardComponent } from "./baseClasses";
import { StandardKey, StandardReferenceSimple } from "./reference";

export class StandardActionPayload implements ComponentConstructorMethods<StandardActionData> {
    _src?: string;
    _dependencies?: string[];
    tag = 'Action' as const;

    constructor(previous?: StandardActionPayload) {
        if (previous) {
            this._src = `${previous.src}`
            this._dependencies = previous.dependencies ? [...previous.dependencies] : undefined
        }
    }

    fromJSON(props: StandardActionData) {
        this._src = props.src
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaAction)(node)) {
            this._src = node.data.src
            return
        }
        throw new Error('Schema mismatch in StandardAction constructor')
    }

    get src() { return this._src ?? '' }
    get dependencies() { return this._dependencies }

    toJSON(): Omit<StandardActionData, 'key' | 'universalKey'> {
        return {
            tag: 'Action',
            src: this.src
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key, uuid: universalKey, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardActionPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }

    subset(): this {
        return new StandardActionPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardAction extends componentClassFactory(StandardActionPayload, 'StandardAction') {
    get src() { return this._payload.src }
    get dependencies() { return this._payload.dependencies }

    override clone(): StandardAction {
        const returnValue = new StandardAction(this)
        returnValue._payload = new StandardActionPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardAction(super.merge(incoming) as StandardAction)
    }

    override withKey(key: string): StandardComponent {
        return new StandardAction(super.withKey(key) as StandardAction)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardAction(super.withUniversalKey(key) as StandardAction)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardAction(super.withFileName(key) as StandardAction)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardAction(super.withImport(importData) as StandardAction)
    }

}

export default StandardAction

import { isSchemaAction, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { StandardActionData } from "./dataTypes/action"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardExportItem, StandardImportItem } from "./metaData";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";

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

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Action', key, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardActionPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct"; }[] {
        return []
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

    override withUniversalKey(key: string): StandardComponent {
        return new StandardAction(super.withUniversalKey(key) as StandardAction)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardAction(super.withFileName(key) as StandardAction)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardAction(super.withImport(importData) as StandardAction)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardAction(super.withExport(exportData) as StandardAction)
    }

}

export default StandardAction

import { isSchemaComputed, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComputedData } from "./dataTypes/computed"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardExportItem, StandardImportItem } from "./metaData";

export class StandardComputedPayload implements ComponentConstructorMethods<StandardComputedData> {
    _src?: string;
    _dependencies?: string[];
    tag = 'Computed' as const;

    fromJSON(props: StandardComputedData) {
        this._src = props.src
        this._dependencies = props.dependencies
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaComputed)(node)) {
            this._src = node.data.src
            return
        }
        throw new Error('Schema mismatch in StandardComputed constructor')
    }

    get src() { return this._src ?? '' }
    get dependencies() { return this._dependencies }

    toJSON(): Omit<StandardComputedData, 'key' | 'universalKey'> {
        return {
            tag: 'Computed',
            src: this.src,
            dependencies: this.dependencies
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Computed', key, src: this.src },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardComputedPayload()
        returnValue._src = incoming.src ?? this.src
        return returnValue as this
    }
}

export class StandardComputed extends componentClassFactory(StandardComputedPayload, 'StandardComputed') {
    get src() { return this._payload.src }
    get dependencies() { return this._payload.dependencies }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardComputed(super.merge(incoming) as StandardComputed)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardComputed(super.withUniversalKey(key) as StandardComputed)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardComputed(super.withFileName(key) as StandardComputed)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardComputed(super.withImport(importData) as StandardComputed)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardComputed(super.withExport(exportData) as StandardComputed)
    }

}

export default StandardComputed

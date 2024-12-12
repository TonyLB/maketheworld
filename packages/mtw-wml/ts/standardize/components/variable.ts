import { isSchemaVariable, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardVariableData } from "./dataTypes/variable"
import { StandardExportItem, StandardImportItem } from "./metaData";

export class StandardVariablePayload implements ComponentConstructorMethods<StandardVariableData> {
    _default?: string;
    tag = 'Variable' as const;

    constructor(previous?: StandardVariablePayload) {
        if (previous) {
            this._default = typeof previous.default !== 'undefined' ? previous.default : undefined
        }
    }

    fromJSON(props: StandardVariableData) {
        this._default = props.default
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaVariable)(node)) {
            this._default = node.data.default
            return
        }
        throw new Error('Schema mismatch in StandardVariable constructor')
    }

    get default() { return this._default ?? '' }

    toJSON(): Omit<StandardVariableData, 'key' | 'universalKey'> {
        return {
            tag: 'Variable',
            default: this.default
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Variable', key, default: this.default },
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardVariablePayload()
        returnValue._default = incoming.default ?? this.default
        return returnValue as this
    }
}

export class StandardVariable extends componentClassFactory(StandardVariablePayload, 'StandardVariable') {
    get default() { return this._payload.default }

    override clone(): StandardVariable {
        const returnValue = new StandardVariable(this)
        returnValue._payload = new StandardVariablePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardVariable(super.merge(incoming) as StandardVariable)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardVariable(super.withUniversalKey(key) as StandardVariable)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardVariable(super.withFileName(key) as StandardVariable)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardVariable(super.withImport(importData) as StandardVariable)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardVariable(super.withExport(exportData) as StandardVariable)
    }

}

export default StandardVariable

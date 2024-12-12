import { isSchemaBookmark, isSchemaDescription, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import { standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"

export class StandardBookmarkPayload implements ComponentConstructorMethods<StandardBookmarkData> {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Bookmark' as const

    constructor(previous?: StandardBookmarkPayload) {
        if (previous) {
            this._description = previous._description
        }
    }

    fromJSON(props: StandardBookmarkData) {
        this._description = props.description
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaBookmark)(node)) {
            const { children } = node
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            return
        }
        throw new Error('Schema mismatch in StandardBookmark constructor')
    }

    get description() { return this._description }

    toJSON(): Omit<StandardBookmarkData, 'key' | 'universalKey'> {
        return {
            tag: 'Bookmark',
            description: this.description
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Bookmark', key },
            children: this.description ? standardFieldToOutputNode(this.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardBookmarkPayload()
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        return returnValue as this
    }
}

export class StandardBookmark extends componentClassFactory(StandardBookmarkPayload, 'StandardBookmark') {
    get description() { return this._payload.description }

    override clone(): StandardBookmark {
        const returnValue = new StandardBookmark(this)
        returnValue._payload = new StandardBookmarkPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardBookmark(super.merge(incoming) as StandardBookmark)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardBookmark(super.withUniversalKey(key) as StandardBookmark)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardBookmark(super.withFileName(key) as StandardBookmark)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardBookmark(super.withImport(importData) as StandardBookmark)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardBookmark(super.withExport(exportData) as StandardBookmark)
    }

}

export default StandardBookmark

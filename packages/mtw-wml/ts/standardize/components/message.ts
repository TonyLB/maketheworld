import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaMessage, isSchemaOutputTag, SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardMessageData } from "./dataTypes/message"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMessagePayload implements ComponentConstructorMethods<StandardMessageData> {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _rooms: GenericTree<SchemaTag> = [];
    tag = 'Message' as const

    fromJSON(props: StandardMessageData) {
        this._description = props.description
        this._rooms = props.rooms
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMessage)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            this._rooms = roomTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMessage constructor')
    }

    get description() { return this._description }
    get rooms() { return this._rooms }

    toJSON(): Omit<StandardMessageData, 'key' | 'universalKey'> {
        return {
            tag: 'Message',
            description: this.description,
            rooms: this.rooms
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Message', key },
            children: [
                ...this.rooms,
                ...[this.description].filter(excludeUndefined).map(({ children }) => (children)).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMessagePayload()
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        return returnValue as this
    }
}

export class StandardMessage extends componentClassFactory(StandardMessagePayload, 'StandardMessage') {
    get description() { return this._payload.description }
    get rooms() { return this._payload.rooms }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMessage(super.merge(incoming) as StandardMessage)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardMessage(super.withUniversalKey(key) as StandardMessage)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMessage(super.withFileName(key) as StandardMessage)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardMessage(super.withImport(importData) as StandardMessage)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardMessage(super.withExport(exportData) as StandardMessage)
    }

}

export default StandardMessage

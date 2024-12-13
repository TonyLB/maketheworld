import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaName, isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardRoomData } from "./dataTypes/room"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"
import linkReferenceKeys, { exitReferenceKeys } from "./utils/references"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag> = [];
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag> = [];
    tag = 'Room' as const

    constructor(previous?: StandardRoomPayload) {
        if (previous) {
            this._shortName = previous.shortName
            this._name = previous.name
            this._summary = previous.summary
            this._description = previous.description
            this._exits = [...previous.exits]
            this._themes = [...previous.themes]
        }
    }

    fromJSON(props: StandardRoomData) {
        this._shortName = props.shortName
        this._name = props.name
        this._summary = props.summary
        this._description = props.description
        this._exits = props.exits
        this._themes = props.themes
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaRoom)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' }),
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            this._summary = outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' }),
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' }),
            this._exits = defaultSelected(exitTagTree.tree)
            this._themes = []
            return
        }
        throw new Error('Schema mismatch in StandardRoom constructor')
    }

    get shortName() { return this._shortName }
    get name() { return this._name }
    get summary() { return this._summary }
    get description() { return this._description }
    get exits() { return this._exits }
    get themes() { return this._themes }

    toJSON(): Omit<StandardRoomData, 'key' | 'universalKey'> {
        return {
            tag: 'Room',
            shortName: this.shortName,
            name: this.name,
            summary: this.summary,
            description: this.description,
            exits: this.exits,
            themes: this.themes
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key },
            children: [
                ...[this.shortName, this.name, this.summary, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.exits
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardRoomPayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        returnValue._shortName = combineTaggedChildren(this.shortName, incoming.shortName) as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>
        returnValue._summary = combineTaggedChildren(this.summary, incoming.summary) as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>
        returnValue._exits = applyEdits([...this.exits, ...incoming.exits])
        returnValue._themes = [...this.themes, ...incoming.themes]
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" }[] {
        return [
            ...linkReferenceKeys([this.summary, this.description].filter(excludeUndefined))
                .map((key) => ({ referenceType: 'Link' as const, key })),
            ...exitReferenceKeys(this.exits)
                .map((key) => ({ referenceType: 'Exit' as const, key })),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get name() { return this._payload.name }
    get shortName() { return this._payload.shortName }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }
    get exits() { return this._payload.exits }
    get themes() { return this._payload.themes }

    override clone(): StandardRoom {
        const returnValue = new StandardRoom(this)
        returnValue._payload = new StandardRoomPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardRoom(super.merge(incoming) as StandardRoom)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardRoom(super.withUniversalKey(key) as StandardRoom)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardRoom(super.withFileName(key) as StandardRoom)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardRoom(super.withImport(importData) as StandardRoom)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardRoom(super.withExport(exportData) as StandardRoom)
    }

}

export default StandardRoom

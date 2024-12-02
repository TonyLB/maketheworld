import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaName, isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import { ComponentInterface, HasShortName } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { isStandardRoom, StandardRoomData } from "./dataTypes/room"
import { editWrap } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardRoomPayload implements HasShortName, ComponentConstructorMethods<StandardRoomData> {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag> = [];
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag> = [];
    tag = 'Room' as const

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
}

export class StandardRoom extends ndjsonWrap(editWrap(class StandardRoom extends StandardComponentWithNameAndDesc implements HasShortName, ComponentInterface {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    tag = 'Room' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            this._exits = []
            this._themes = []
            return
        }
        if (isStandardRoom(payload)) {
            this._shortName = payload.shortName
            this._summary = payload.summary
            this._exits = payload.exits
            this._themes = payload.themes
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaRoom)(node)) {
                const tagTree = new SchemaTagTree(node.children)
                const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
                const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
                const exitTagTree = tagTree
                    .filter({ match: 'Exit' })
                    .reorderedSiblings([['Room', 'Exit'], ['If']])
                this._shortName = outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' }),
                this._summary = outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' }),
                this._exits = defaultSelected(exitTagTree.tree)
                this._themes = []
                return
            }
        }
        throw new Error('Type mismatch in StandardRoom constructor')
    }

    override get payload(): StandardRoom {
        const returnValue = new StandardRoom(this.toJSON())
        returnValue._remove = false
        return returnValue
    }

    get shortName() { return this._shortName }
    get summary() { return this._summary }
    get exits() { return this._exits }
    get themes() { return this._themes }

    override toJSON(): StandardRoomData {
        return {
            ...super.toJSON(),
            tag: 'Room',
            shortName: this.shortName,
            name: this.name,
            summary: this.summary,
            description: this.description,
            exits: this.exits,
            themes: this.themes
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Room', key: this.key },
            children: [
                ...[this.shortName, this.name, this.summary, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...this.exits
            ]
        }
    }

    override clone(): this {
        return new StandardRoom(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardRoom)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming as this)
        if (!superMerge) {
            throw new Error('Merge failure in StandardRoom')
        }
        const returnValue = this.clone() as this
        returnValue._name = superMerge.name
        returnValue._description = superMerge.description
        returnValue._shortName = combineTaggedChildren(this.shortName, incoming.shortName) as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>
        returnValue._summary = combineTaggedChildren(this.summary, incoming.summary) as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>
        returnValue._exits = applyEdits([...this.exits, ...incoming.exits])
        returnValue._themes = [...this.themes, ...incoming.themes]
        return returnValue
    }
}, 'StandardRoom')){}

export class StandardRoomRefactored extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    get name() { return this._payload.name }
    get shortName() { return this._payload.shortName }
    get summary() { return this._payload.summary }
    get description() { return this._payload.description }
    get exits() { return this._payload.exits }
    get themes() { return this._payload.themes }
}

export default StandardRoom

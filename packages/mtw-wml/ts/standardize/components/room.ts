import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardRoom } from "../baseClasses"
import { ComponentInterface, HasShortName } from "./abstract"
import { StandardRoomData } from "./dataTypes/room"
import { editWrap } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardRoom extends editWrap(class StandardRoom extends StandardComponentWithNameAndDesc implements HasShortName, ComponentInterface {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    tag = 'Room' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaRoom(payload.data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            const tagTree = new SchemaTagTree(payload.children)
            const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
            const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
            const exitTagTree = tagTree
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' }),
            this._summary = outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' }),
            this._exits = defaultSelected(exitTagTree.tree)
            this._themes = []
        }
        else {
            if (!isStandardRoom(payload)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            this._shortName = payload.shortName
            this._summary = payload.summary
            this._exits = payload.exits
            this._themes = payload.themes
        }
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
}, 'StandardRoom'){}

export default StandardRoom

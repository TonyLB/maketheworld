import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRoomData } from "./dataTypes/room"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardRoom extends StandardComponentWithNameAndDesc {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    tag = 'Room' as const
    constructor(args: StandardRoomData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaRoom(args.data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            const tagTree = new SchemaTagTree(args.children)
            const shortNameItem = tagTree.filter({ match: 'ShortName' }).tree.find(wrappedNodeTypeGuard(isSchemaShortName))
            const summaryItem = tagTree.filter({ match: 'Summary' }).tree.find(wrappedNodeTypeGuard(isSchemaSummary))
            const exitTagTree = new SchemaTagTree(args.children)
                .filter({ match: 'Exit' })
                .reorderedSiblings([['Room', 'Exit'], ['If']])
            this._shortName = outputNodeToStandardItem<SchemaShortNameTag, SchemaOutputTag>(shortNameItem, isSchemaShortName, isSchemaOutputTag, { tag: 'ShortName' }),
            this._summary = outputNodeToStandardItem<SchemaSummaryTag, SchemaOutputTag>(summaryItem, isSchemaSummary, isSchemaOutputTag, { tag: 'Summary' }),
            this._exits = defaultSelected(exitTagTree.tree)
            this._themes = []
        }
        else {
            this._shortName = args.shortName
            this._summary = args.summary
            this._exits = args.exits
            this._themes = args.themes
        }
    }

    get shortName() { return this._shortName }
    get summary() { return this._summary }
    get exits() { return this._exits }
    get themes() { return this._themes }

    override toJSON(): StandardRoomData {
        return {
            key: this.key,
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
                ...[this.shortName, this.name, this.summary, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.exits
            ]
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardRoom {
        if (!(incoming instanceof StandardRoom)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming)
        const args: StandardRoomData = {
            ...superMerge.toJSON(),
            tag: 'Room',
            shortName: combineTaggedChildren(this.shortName, incoming.shortName) as EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>,
            summary: combineTaggedChildren(this.summary, incoming.summary) as EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>,
            exits: applyEdits([...this.exits, ...incoming.exits]),
            themes: [...this.themes, ...incoming.themes]
        }
        return new StandardRoom(args)
    }
}

export default StandardRoom

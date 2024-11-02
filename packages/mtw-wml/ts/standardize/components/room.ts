import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaOutputTag, isSchemaRoom, isSchemaShortName, isSchemaSummary, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardRoom, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardRoomData } from "./dataTypes/room"
import { unwrapConstructorArgs, wrapJSON, wrapSchema } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardRoom extends StandardComponentWithNameAndDesc {
    _shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    _summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    _exits: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    _match?: StandardRoom;
    tag = 'Room' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardRoom(match)
        }
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

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get shortName() { return this._shortName }
    get summary() { return this._summary }
    get exits() { return this._exits }
    get themes() { return this._themes }

    override toJSON(): StandardRoomData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardRoom, StandardRoomData>(this, (value) => ({
            key: value.key,
            tag: 'Room',
            shortName: value.shortName,
            name: value.name,
            summary: value.summary,
            description: value.description,
            exits: value.exits,
            themes: value.themes
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardRoom) => ({
            data: { tag: 'Room', key: value.key },
            children: [
                ...[value.shortName, value.name, value.summary, value.description].filter(excludeUndefined).filter(({ children }) => (children.length)),
                ...value.exits
            ]
        }))
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

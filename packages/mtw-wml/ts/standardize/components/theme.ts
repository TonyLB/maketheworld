import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaMap, isSchemaName, isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardMapData } from "./dataTypes/map"
import { StandardThemeData } from "./dataTypes/theme"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardTheme extends StandardComponentAbstract {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    _rooms: GenericTree<SchemaTag>;
    _maps: GenericTree<SchemaTag>;
    tag = 'Theme' as const
    constructor(args: StandardThemeData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaTheme(args.data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            const tagTree = new SchemaTagTree(args.children)
            const nameItem = args.children.find(treeNodeTypeguard(isSchemaName))
            const promptTagTree = tagTree.filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            const mapsTagTree = tagTree.filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._prompts = promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt))
            this._rooms = roomTagTree.tree
            this._maps = mapsTagTree.tree
        }
        else {
            this._name = args.name
            this._prompts = args.prompts
            this._rooms = args.rooms
            this._maps = args.maps
        }
    }

    get name() { return this._name }
    get prompts() { return this._prompts }
    get rooms() { return this._rooms }
    get maps() { return this._maps }

    override toJSON(): StandardThemeData {
        return {
            key: this.key,
            tag: 'Theme',
            name: this.name,
            prompts: this.prompts,
            rooms: this.rooms,
            maps: this.maps
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Theme', key: this.key },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.prompts,
                ...this.rooms,
                ...this.maps
            ]
        }
    }

    override merge(incoming: StandardComponentAbstract): StandardTheme {
        if (!(incoming instanceof StandardTheme)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardThemeData = {
            key: this.key,
            tag: 'Theme',
            name: combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>,
            prompts: applyEdits([...this.prompts, ...incoming.prompts]).filter(treeNodeTypeguard(isSchemaPrompt)),
            rooms: applyEdits([...this.rooms, ...incoming.rooms]),
            maps: applyEdits([...this.maps, ...incoming.maps])
        }
        return new StandardTheme(args)
    }
}

export default StandardTheme

import { excludeUndefined } from "../../lib/lists"
import { isSchemaName, isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { isStandardTheme, StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardThemeData } from "./dataTypes/theme"
import { unwrapConstructorArgs, wrapJSON, wrapSchema } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardTheme extends StandardComponentAbstract {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    _rooms: GenericTree<SchemaTag>;
    _maps: GenericTree<SchemaTag>;
    _match?: StandardTheme;
    tag = 'Theme' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaTheme(payload.data)) {
                throw new Error('Type mismatch in StandardTheme constructor')
            }
            const tagTree = new SchemaTagTree(payload.children)
            const nameItem = payload.children.find(treeNodeTypeguard(isSchemaName))
            const promptTagTree = tagTree.filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            const mapsTagTree = tagTree.filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._prompts = promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt))
            this._rooms = roomTagTree.tree
            this._maps = mapsTagTree.tree
        }
        else {
            if (!isStandardTheme(payload)) {
                throw new Error('Type mismatch in StandardTheme constructor')
            }
            this._name = payload.name
            this._prompts = payload.prompts
            this._rooms = payload.rooms
            this._maps = payload.maps
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get name() { return this._name }
    get prompts() { return this._prompts }
    get rooms() { return this._rooms }
    get maps() { return this._maps }

    override toJSON(): StandardThemeData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardTheme, StandardThemeData>(this, (value) => ({
            key: value.key,
            tag: 'Theme',
            name: value.name,
            prompts: value.prompts,
            rooms: value.rooms,
            maps: value.maps
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardTheme) => ({
            data: { tag: 'Theme', key: value.key },
            children: [
                ...[value.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...value.prompts,
                ...value.rooms,
                ...value.maps
            ]
        }))
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

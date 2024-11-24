import { excludeUndefined } from "../../lib/lists"
import { isSchemaName, isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { isStandardTheme } from "./dataTypes"
import { StandardThemeData } from "./dataTypes/theme"
import { editWrap } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardTheme extends editWrap(class StandardTheme extends StandardComponentAbstract implements ComponentInterface {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    _rooms: GenericTree<SchemaTag>;
    _maps: GenericTree<SchemaTag>;
    tag = 'Theme' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardTheme(payload)) {
            this._name = payload.name
            this._prompts = payload.prompts
            this._rooms = payload.rooms
            this._maps = payload.maps
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaTheme)(payload)) {
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
            throw new Error('Type mismatch in StandardTheme constructor')
        }
    }

    get name() { return this._name }
    get prompts() { return this._prompts }
    get rooms() { return this._rooms }
    get maps() { return this._maps }

    override toJSON(): StandardThemeData {
        return {
            ...super.toJSON(),
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

    override clone(): this {
        return new StandardTheme(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (incoming.key !== this.key || !(incoming instanceof StandardTheme)) {
            throw new Error('Source mismatch in StandardTheme merge')
        }
        const returnValue = this.clone()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._prompts = applyEdits([...this.prompts, ...incoming.prompts]).filter(treeNodeTypeguard(isSchemaPrompt))
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        returnValue._maps = applyEdits([...this.maps, ...incoming.maps])
        return returnValue
    }
}, 'StandardTheme'){}

export default StandardTheme

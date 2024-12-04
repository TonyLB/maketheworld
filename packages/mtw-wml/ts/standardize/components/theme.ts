import { excludeUndefined } from "../../lib/lists"
import { isSchemaName, isSchemaOutputTag, isSchemaPrompt, isSchemaTheme, SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { isStandardTheme } from "./dataTypes"
import { StandardThemeData } from "./dataTypes/theme"
import { editWrap } from "./editable"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardThemePayload implements ComponentConstructorMethods<StandardThemeData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag> = [];
    _rooms: GenericTree<SchemaTag> = [];
    _maps: GenericTree<SchemaTag> = [];
    tag = 'Theme' as const

    fromJSON(props: StandardThemeData) {
        this._name = props.name
        this._prompts = props.prompts
        this._rooms = props.rooms
        this._maps = props.maps
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaTheme)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = node.children.find(treeNodeTypeguard(isSchemaName))
            const promptTagTree = tagTree.filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            const mapsTagTree = tagTree.filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._prompts = promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt))
            this._rooms = roomTagTree.tree
            this._maps = mapsTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get name() { return this._name }
    get prompts() { return this._prompts }
    get rooms() { return this._rooms }
    get maps() { return this._maps }

    toJSON(): Omit<StandardThemeData, 'key' | 'universalKey'> {
        return {
            tag: 'Theme',
            name: this.name,
            prompts: this.prompts,
            rooms: this.rooms,
            maps: this.maps
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Theme', key },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.prompts,
                ...this.rooms,
                ...this.maps
            ]
        }
    }

    merge(incoming: this): this {
        if (!(incoming instanceof StandardThemePayload)) {
            throw new Error('Source mismatch in StandardTheme merge')
        }
        const returnValue = new StandardThemePayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._prompts = applyEdits([...this.prompts, ...incoming.prompts]).filter(treeNodeTypeguard(isSchemaPrompt))
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        returnValue._maps = applyEdits([...this.maps, ...incoming.maps])
        return returnValue as this
    }
}

export class StandardTheme extends componentClassFactory(StandardThemePayload, 'StandardMoment') {
    get name() { return this._payload.name }
    get prompts() { return this._payload.prompts }
    get rooms() { return this._payload.rooms }
    get maps() { return this._payload.maps }
}

export class StandardThemeLegacy extends ndjsonWrap(editWrap(class StandardTheme extends StandardComponentAbstract implements ComponentInterface {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    _rooms: GenericTree<SchemaTag>;
    _maps: GenericTree<SchemaTag>;
    tag = 'Theme' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            this._prompts = []
            this._rooms = []
            this._maps = []
            return
        }
        if (isStandardTheme(payload)) {
            this._name = payload.name
            this._prompts = payload.prompts
            this._rooms = payload.rooms
            this._maps = payload.maps
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaTheme)(node)) {
                const tagTree = new SchemaTagTree(node.children)
                const nameItem = node.children.find(treeNodeTypeguard(isSchemaName))
                const promptTagTree = tagTree.filter({ match: 'Prompt' }).prune({ not: { match: 'Prompt' } })
                const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
                const mapsTagTree = tagTree.filter({ match: 'Map' }).prune({ not: { match: 'Map' }})
                this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
                this._prompts = promptTagTree.tree.filter(treeNodeTypeguard(isSchemaPrompt))
                this._rooms = roomTagTree.tree
                this._maps = mapsTagTree.tree
                return
            }
        }
        throw new Error('Type mismatch in StandardTheme constructor')
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
}, 'StandardTheme')){}

export default StandardTheme

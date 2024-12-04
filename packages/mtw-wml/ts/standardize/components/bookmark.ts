import { isSchemaBookmark, isSchemaDescription, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import { isStandardBookmark } from './dataTypes'
import { editWrap } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"
import { ndjsonWrap } from "./ndjson"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import SchemaTagTree from "../../tagTree/schema"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { excludeUndefined } from "../../lib/lists"

export class StandardBookmarkPayload implements ComponentConstructorMethods<StandardBookmarkData> {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Bookmark' as const

    fromJSON(props: StandardBookmarkData) {
        this._description = props.description
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaBookmark)(node)) {
            const { children } = node
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            return
        }
        throw new Error('Schema mismatch in StandardBookmark constructor')
    }

    get description() { return this._description }

    toJSON(): Omit<StandardBookmarkData, 'key' | 'universalKey'> {
        return {
            tag: 'Bookmark',
            description: this.description
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Bookmark', key },
            children: this.description ? standardFieldToOutputNode(this.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardBookmarkPayload()
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        return returnValue as this
    }
}

export class StandardBookmark extends componentClassFactory(StandardBookmarkPayload, 'StandardBookmark') {
    get description() { return this._payload.description }
}

export class StandardBookmarkLegacy extends ndjsonWrap(editWrap(class StandardBookmark extends StandardComponentAbstract implements ComponentInterface {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Bookmark' as const;
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload) )) {
            return
        }
        if (isStandardBookmark(payload)) {
            this._description = payload.description
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (treeNodeTypeguard(isSchemaBookmark)(node)) {
                const { children } = node
                this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
                return
            }
        }
        throw new Error('Type mismatch in StandardBookmark constructor')
    }

    get description() {
        return this._description
    }

    override toJSON(): StandardBookmarkData {
        const superArgs = super.toJSON()
        return {
            ...superArgs,
            tag: 'Bookmark',
            description: this.description
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Bookmark', key: this.key },
            children: this.description ? standardFieldToOutputNode(this.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : []
        }
    }

    override clone(): this {
        return new StandardBookmark(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardBookmark)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const returnValue = this.clone()
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        return returnValue
    }
}, 'StandardBookmark')){}

export default StandardBookmark

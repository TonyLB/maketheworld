import { isSchemaBookmark, isSchemaDescription, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardBookmark } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface } from "./abstract"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import { editWrap } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardBookmark extends editWrap(class StandardBookmark extends StandardComponentAbstract implements ComponentInterface {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Bookmark' as const;
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (typeof payload === 'string' || !payload) {
        }
        else if (isStandardBookmark(payload)) {
            this._description = payload.description
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaBookmark)(payload)) {
            const { data } = payload
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children: payload.children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
        }
        else {
            throw new Error('Type mismatch in StandardBookmark constructor')
        }
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
}, 'StandardBookmark'){}

export default StandardBookmark

import { isSchemaBookmark, isSchemaDescription, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardBookmark, StandardComponentData } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardBookmark extends StandardComponentAbstract {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    _match?: StandardBookmark;
    tag = 'Bookmark' as const;
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardBookmark(match)
        }
        if (isSchemaTreeNode(payload)) {
            const { data } = payload
            if (!isSchemaBookmark(data)) {
                throw new Error('Type mismatch in StandardBookmark constructor')
            }
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children: payload.children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
        }
        else {
            if (!isStandardBookmark(payload)) {
                throw new Error('Type mismatch in StandardBookmark constructor')
            }
            this._description = payload.description
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get description() {
        return this._description
    }

    override toJSON(): StandardBookmarkData | StandardRemoveData | StandardReplaceData {
        const superArgs = super.toJSON()
        return wrapJSON<StandardBookmark, StandardBookmarkData>(this, (value) => ({
            ...superArgs,
            tag: 'Bookmark',
            description: this.description
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardBookmark) => ({
            data: { tag: 'Bookmark', key: value.key },
            children: value.description ? standardFieldToOutputNode(value.description).filter(({ children }) => (children.length)).map(({ children }) => (children)).flat(1) : []
        }))
    }

    override merge(incoming: StandardComponentAbstract): StandardBookmark | undefined {
        if (!(incoming instanceof StandardBookmark)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardBookmark>(this, incoming, StandardBookmark, (base, incoming) => {
            const args: StandardBookmarkData = {
                key: base.key,
                tag: 'Bookmark',
                description: combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
            }
            return new StandardBookmark(args)
        })
    }
}

export default StandardBookmark

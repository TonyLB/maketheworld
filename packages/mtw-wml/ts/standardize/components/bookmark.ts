import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardBookmarkData } from "./dataTypes/bookmark"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

type NameAndDesc = {
    name: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export class StandardBookmark extends StandardComponentAbstract {
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    constructor(args: StandardBookmarkData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>({ data: { tag: 'Description' }, children: args.children }, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
        }
        else {
            this._description = args.description
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

    override merge(incoming: StandardComponentAbstract): StandardBookmark {
        if (!(incoming instanceof StandardBookmark)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardBookmarkData = {
            key: this.key,
            tag: 'Bookmark',
            description: combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        }
        return new StandardBookmark(args)
    }
}

export default StandardBookmark

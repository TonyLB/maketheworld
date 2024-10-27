import { isSchemaDescription, isSchemaName, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

type NameAndDesc = {
    name: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export class StandardComponentWithNameAndDesc extends StandardComponentAbstract {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    constructor(args: (StandardBaseData & Partial<NameAndDesc>) | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            const tagTree = new SchemaTagTree(args.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
        }
        else {
            this._name = args.name
            this._description = args.description
        }
    }

    get name() {
        return this._name
    }

    get description() {
        return this._description
    }

    override toJSON(): StandardBaseData & Partial<NameAndDesc> {
        const superArgs = super.toJSON()
        return {
            ...superArgs,
            name: this.name,
            description: this.description
        }
    }

    override merge(incoming: StandardComponentWithNameAndDesc): StandardComponentWithNameAndDesc {
        const args = {
            key: this.key,
            name: combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>,
            description: combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        }
        return new StandardComponentWithNameAndDesc(args)
    }
}

export default StandardComponentWithNameAndDesc


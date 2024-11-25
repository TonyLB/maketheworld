import { isSchemaDescription, isSchemaName, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { EditWrappedStandardNode, isStandardFeature, isStandardKnowledge, isStandardRoom } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import StandardComponentAbstract, { ComponentInterface, HasDescription, HasName } from "./abstract"
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

type NameAndDesc = {
    name: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export class StandardComponentWithNameAndDesc extends StandardComponentAbstract implements HasName, HasDescription, ComponentInterface {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload))) {
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            return
        }
        if (isStandardRoom(payload) || isStandardFeature(payload) || isStandardKnowledge(payload)) {
            this._name = payload.name
            this._description = payload.description
            return
        }
        throw new Error('Invalid argument type to StandardComponent with name and description')
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

    override merge(incoming: this): this | undefined {
        const args = {
            key: this.key,
            tag: 'Feature' as const,
            name: combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>,
            description: combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        }
        return new StandardComponentWithNameAndDesc(args) as this | undefined
    }
}

export default StandardComponentWithNameAndDesc


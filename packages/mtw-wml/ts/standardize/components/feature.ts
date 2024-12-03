import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaFeature, isSchemaName, isSchemaOutputTag, SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode, isStandardFeature } from "../baseClasses"
import { isLegalKey, nodeFromWML } from "../utils"
import { ComponentInterface } from "./abstract"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardFeatureData } from "./dataTypes/feature"
import { editWrap } from "./editable"
import StandardComponentWithNameAndDesc from "./nameAndDesc"
import { ndjsonWrap } from "./ndjson"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardFeaturePayload implements ComponentConstructorMethods<StandardFeatureData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    tag = 'Feature' as const

    fromJSON(props: StandardFeatureData) {
        this._name = props.name
        this._description = props.description
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const descriptionItem = tagTree.filter({ match: 'Description' }).tree.find(wrappedNodeTypeGuard(isSchemaDescription))
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' }),
            this._description = outputNodeToStandardItem<SchemaDescriptionTag, SchemaOutputTag>(descriptionItem, isSchemaDescription, isSchemaOutputTag, { tag: 'Description' })
            return
        }
        throw new Error('Schema mismatch in StandardFeature constructor')
    }

    get name() { return this._name }
    get description() { return this._description }

    toJSON(): Omit<StandardFeatureData, 'key' | 'universalKey'> {
        return {
            tag: 'Feature',
            name: this.name,
            description: this.description
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length))
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardFeaturePayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._description = combineTaggedChildren(this.description, incoming.description) as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>
        return returnValue as this
    }
}

export class StandardFeatureRefactored extends componentClassFactory(StandardFeaturePayload, 'StandardFeature') {
    get name() { return this._payload.name }
    get description() { return this._payload.description }
}

export class StandardFeature extends ndjsonWrap(editWrap(class StandardFeature extends StandardComponentWithNameAndDesc implements ComponentInterface {
    tag = 'Feature' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (!payload || (typeof payload === 'string' && isLegalKey(payload)) || isStandardFeature(payload)) {
            return
        }
        if (isSchemaTreeNode(payload) || typeof payload === 'string') {
            const node = typeof payload === 'string'
                ? nodeFromWML(payload)
                : payload
            if (isSchemaFeature(node.data)) {
                return
            }
        }
        throw new Error('Type mismatch in StandardAction constructor')
    }

    override toJSON(): StandardFeatureData {
        return {
            ...super.toJSON(),
            tag: 'Feature',
            name: this.name,
            description: this.description
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Feature', key: this.key },
            children: [this.name, this.description].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1)
        }
    }

    override clone(): this {
        return new StandardFeature(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardFeature)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const superMerge = super.merge(incoming as this)
        if (!superMerge) {
            throw new Error('Merge failure in StandardKnowledge')
        }
        const returnValue = this.clone() as this
        returnValue._name = superMerge.name
        returnValue._description = superMerge.description
        return returnValue
    }
}, 'StandardFeature')){}

export default StandardFeature

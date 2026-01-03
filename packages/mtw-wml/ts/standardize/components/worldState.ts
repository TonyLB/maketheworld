import { excludeUndefined } from "../../lib/lists"
import { filterEditableTree, stripTagFromTree, wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent, StandardComponentReferenceKey } from "./baseClasses"
import linkReferenceKeys, { ReferenceFormat } from "./utils/references"
import { StandardRender } from "../render"
import { rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { StandardToJSONOptions } from "./baseClasses"
import { StandardMarkData } from "./dataTypes/mark"
import { AssetUUID, ComponentUUID, isSchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaShortName } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaMark } from "@tonylb/mtw-base/ts/schema/worldState"
import { deepEqual } from "../../lib/objects"
import { renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardKey } from "../keys/key"
import StandardReference from "../keys/reference"
import { HasShortName } from "./abstract"
import { StandardLiteral } from "../literal"

export class StandardMarkPayload implements HasShortName, ComponentConstructorMethods<StandardMarkData> {
    _shortName?: StandardLiteral;
    _description?: StandardRender;
    tag = 'Mark' as const

    constructor(previous?: StandardMarkPayload) {
        if (previous) {
            this._shortName = previous._shortName
            this._description = previous._description
        }
    }

    fromJSON(props: StandardMarkData) {
        const { shortName, description } = props
        this._shortName = shortName ? new StandardLiteral(shortName) : undefined
        this._description = description ? new StandardRender(description) : undefined
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMark)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const shortNameNode = stripTagFromTree(filterEditableTree({ tree: node.children, typeguard: treeNodeTypeguard(isSchemaShortName) }), 'ShortName')
            this._shortName = shortNameNode.length ? new StandardLiteral(shortNameNode) : undefined
            const descriptionItem = tagTree
                .filter({ match: 'Description' })
                .prune({ match: 'Description' })
                .tree
                .filter(wrappedNodeTypeGuard(isSchemaOutputTag))
            this._description = descriptionItem.length ? new StandardRender(descriptionItem) : undefined
            return
        }
        throw new Error('Schema mismatch in StandardMark constructor')
    }

    get shortName() { return this._shortName }
    get description() { return this._description }

    toJSON(options?: StandardToJSONOptions): Omit<StandardMarkData, 'key' | 'universalKey'> {
        return {
            tag: 'Mark',
            shortName: this?.shortName?.toJSON(),
            description: this?.description?.toJSON()
        }
    }

    schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
        const children = [
            ...[this.shortName].filter(excludeUndefined).map((shortName) => (shortName.nestedSchema({ tag: 'ShortName' }))).flat(1),
            rebuildSchemaFromStandardRender(this._description, { tag: 'Description' }, mappings)
        ].filter(excludeUndefined)
        return {
            data: { tag: 'Mark', key, uuid: universalKey },
            children
        }
    }

    subset(): this {
        return new StandardMarkPayload() as this
    }

    merge(incoming: this): this {
        const returnValue = new StandardMarkPayload()
        returnValue._shortName = (this._shortName && incoming._shortName) ? this._shortName.merge(incoming._shortName) : this._shortName ?? incoming._shortName
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        return returnValue as this
    }

    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        const renderTrees = [this._description?.toJSON()].filter(excludeUndefined)
        return [
            ...linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1)))
                .map((reference) => ({ referenceType: 'Link' as const, reference }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMarkPayload(this)
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents((renderTree) => (schemaToRenderTree(callback(renderTreeToSchema(renderTree)))))
        }
        return returnValue as this
    }
    
    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMarkPayload(this)
        returnValue._description = returnValue._description?.remapReferences({ mapping: props.mappings, mapTo: props.mapTo })
        return returnValue as this
    }

    invert(): this {
        const returnValue = new StandardMarkPayload()
        returnValue._shortName = this._shortName ? this._shortName.invert() as StandardLiteral : undefined
        returnValue._description = this._description ? this._description.invert() : undefined
        return returnValue as this
    }

    isEmpty(): boolean {
        // A mark is empty if it has no shortName and no description
        const hasShortName = Boolean(this._shortName)
        const hasDescription = Boolean(this._description)
        return !(hasShortName || hasDescription)
    }

}

export class StandardMark extends componentClassFactory(StandardMarkPayload, 'StandardMark') {
    get shortName() { return this._payload.shortName }
    get description() { return this._payload.description }

    constructor(props: string | StandardMarkData | GenericTreeNode<SchemaTag> | StandardMark) {
        super(props)
    }

    override _wrap(instance: StandardComponent): this {
        return new StandardMark(instance as StandardMark) as this
    }

    override clone(): StandardMark {
        const returnValue = new StandardMark(this)
        returnValue._payload = new StandardMarkPayload(this._payload)
        return returnValue
    }

    override equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardMark)) {
            return false
        }
        return deepEqual(this.toJSON(), incoming.toJSON())
    }

}

export default StandardMark

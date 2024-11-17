import { excludeUndefined } from "../../lib/lists"
import { isSchemaMap, isSchemaName, isSchemaOutputTag, SchemaNameTag, SchemaOutputTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract, { ComponentInterface, HasName } from "./abstract"
import { isStandardMap, StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardMapData } from "./dataTypes/map"
import { editWrap, unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMap extends editWrap(class StandardMap extends StandardComponentAbstract implements HasName, ComponentInterface {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _images: GenericTree<SchemaTag>;
    _positions: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    tag = 'Map' as const
    constructor(...args: any[]) {
        const payload = args[0]
        super(payload)
        if (isStandardMap(payload)) {
            this._name = payload.name
            this._images = payload.images
            this._positions = payload.positions
            this._themes = payload.themes
        }
        else if (isSchemaTreeNode(payload) && treeNodeTypeguard(isSchemaMap)(payload)) {
            const tagTree = new SchemaTagTree(payload.children)
            const nameItem = tagTree.filter({ match: 'Name' }).tree.find(wrappedNodeTypeGuard(isSchemaName))
            const positionsTagTree = tagTree
                .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { or: [{ match: 'Position' }, { match: 'Exit' }] }])
                .prune({ not: { or: [
                    { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }] }] }, { match: 'Room' }, { match: 'Position' }, { match: 'Exit' }
                ]}})
                .reorderedSiblings([['Room', 'Exit', 'Position'], ['If']])
            
            const imagesTagTree = tagTree.filter({ match: 'Image' })
            this._name = outputNodeToStandardItem<SchemaNameTag, SchemaOutputTag>(nameItem, isSchemaName, isSchemaOutputTag, { tag: 'Name' })
            this._images = imagesTagTree.tree
            this._positions = positionsTagTree.tree
            this._themes = []
        }
        else {
            throw new Error('Type mismatch in StandardMap constructor')
        }
    }

    get name() { return this._name }
    get images() { return this._images }
    get positions() { return this._positions }
    get themes() { return this._themes }

    override toJSON(): StandardMapData {
        return {
            key: this.key,
            tag: 'Map',
            name: this.name,
            images: this.images,
            positions: this.positions,
            themes: this.themes
        }
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Map', key: this.key },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.images,
                ...this.positions,
                ...this.themes
            ]
        }
    }

    override clone(): this {
        return new StandardMap(this.toJSON()) as this
    }

    override merge(incoming: this): this | undefined {
        if (!(incoming instanceof StandardMap)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const returnValue = this.clone() as this
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._images = applyEdits([...this.images, ...incoming.images])
        returnValue._positions = applyEdits([...this.positions, ...incoming.positions])
        returnValue._themes = [...this.themes, ...incoming.themes]
        return returnValue
    }
}, 'StandardMap'){}

export default StandardMap

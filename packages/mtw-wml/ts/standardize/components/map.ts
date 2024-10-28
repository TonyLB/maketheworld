import { defaultSelected } from ".."
import { excludeUndefined } from "../../lib/lists"
import { isSchemaMap, isSchemaName, isSchemaOutputTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract from "./abstract"
import { StandardMapData } from "./dataTypes/map"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMap extends StandardComponentAbstract {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _images: GenericTree<SchemaTag>;
    _positions: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    tag = 'Map' as const
    constructor(args: StandardMapData | GenericTreeNode<SchemaTag>) {
        super(args)
        if (isSchemaTreeNode(args)) {
            if (!isSchemaMap(args.data)) {
                throw new Error('Type mismatch in StandardRoom constructor')
            }
            const tagTree = new SchemaTagTree(args.children)
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
            this._name = args.name
            this._images = args.images
            this._positions = args.positions
            this._themes = args.themes
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

    override merge(incoming: StandardComponentAbstract): StandardMap {
        if (!(incoming instanceof StandardMap)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        const args: StandardMapData = {
            key: this.key,
            tag: 'Map',
            name: combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>,
            images: applyEdits([...this.images, ...incoming.images]),
            positions: applyEdits([...this.positions, ...incoming.positions]),
            themes: [...this.themes, ...incoming.themes]
        }
        return new StandardMap(args)
    }
}

export default StandardMap

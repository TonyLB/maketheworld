import { excludeUndefined } from "../../lib/lists"
import { isSchemaMap, isSchemaName, isSchemaOutputTag, SchemaNameTag, SchemaOutputTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import StandardComponentAbstract, { HasName } from "./abstract"
import { isStandardMap, StandardComponentData, StandardRemoveData, StandardReplaceData } from "./dataTypes"
import { StandardMapData } from "./dataTypes/map"
import { unwrapConstructorArgs, wrapJSON, wrapMerge, wrapSchema } from "./editable"
import { isSchemaTreeNode, standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { combineTaggedChildren } from "./utils/merge"

export class StandardMap extends StandardComponentAbstract implements HasName {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _images: GenericTree<SchemaTag>;
    _positions: GenericTree<SchemaTag>;
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    _match?: StandardMap;
    tag = 'Map' as const
    constructor(args: StandardComponentData | GenericTreeNode<SchemaTag>) {
        const { payload, remove, match } = unwrapConstructorArgs(args)
        super(payload)
        this._remove = remove
        if (match) {
            this._match = new StandardMap(match)
        }
        if (isSchemaTreeNode(payload)) {
            if (!isSchemaMap(payload.data)) {
                throw new Error('Type mismatch in StandardMap constructor')
            }
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
            if (!isStandardMap(payload)) {
                throw new Error('Type mismatch in StandardMap constructor')
            }
            this._name = payload.name
            this._images = payload.images
            this._positions = payload.positions
            this._themes = payload.themes
        }
    }

    override get isReplace() { return Boolean(this._match) }
    override get match() { return this._match }

    get name() { return this._name }
    get images() { return this._images }
    get positions() { return this._positions }
    get themes() { return this._themes }

    override toJSON(): StandardMapData | StandardRemoveData | StandardReplaceData {
        return wrapJSON<StandardMap, StandardMapData>(this, (value) => ({
            key: value.key,
            tag: 'Map',
            name: value.name,
            images: value.images,
            positions: value.positions,
            themes: value.themes
        }))
    }

    override get schema(): GenericTreeNode<SchemaTag> {
        return wrapSchema(this, (value: StandardMap) => ({
            data: { tag: 'Map', key: value.key },
            children: [
                ...[value.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...value.images,
                ...value.positions,
                ...value.themes
            ]
        }))
    }

    override merge(incoming: StandardComponentAbstract): StandardMap | undefined {
        if (!(incoming instanceof StandardMap)) {
            throw new Error('Type mistmatch on StandardComponent merge')
        }
        return wrapMerge<StandardMap>(this, incoming, StandardMap, (base, incoming) => {
            const args: StandardMapData = {
                key: base.key,
                tag: 'Map',
                name: combineTaggedChildren(base.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>,
                images: applyEdits([...base.images, ...incoming.images]),
                positions: applyEdits([...base.positions, ...incoming.positions]),
                themes: [...base.themes, ...incoming.themes]
            }
            return new StandardMap(args)
        })
    }
}

export default StandardMap

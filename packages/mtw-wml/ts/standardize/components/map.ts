import { excludeUndefined } from "../../lib/lists"
import { isSchemaMap, isSchemaName, isSchemaOutputTag, SchemaNameTag, SchemaOutputTag, SchemaTag, SchemaThemeTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardMapData } from "./dataTypes/map"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { standardFieldToOutputNode } from "./utils"
import { outputNodeToStandardItem } from "./utils/constructor"
import { applyTreeCallbackToNode } from "./utils/mapContents"
import { combineTaggedChildren } from "./utils/merge"
import { positionReferenceKeys } from "./utils/references"

export class StandardMapPayload implements ComponentConstructorMethods<StandardMapData> {
    _name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    _images: GenericTree<SchemaTag> = [];
    _positions: GenericTree<SchemaTag> = [];
    _themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag> = [];
    tag = 'Map' as const

    constructor(previous?: StandardMapPayload) {
        if (previous) {
            this._name = previous._name
            this._images = [...previous._images]
            this._positions = [...previous.positions]
            this._themes = [...previous.themes]
        }
    }

    fromJSON(props: StandardMapData) {
        this._name = props.name
        this._images = props.images
        this._positions = props.positions
        this._themes = props.themes
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMap)(node)) {
            const tagTree = new SchemaTagTree(node.children)
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
            return
        }
        throw new Error('Schema mismatch in StandardMap constructor')
    }

    get name() { return this._name }
    get images() { return this._images }
    get positions() { return this._positions }
    get themes() { return this._themes }

    toJSON(): Omit<StandardMapData, 'key' | 'universalKey'> {
        return {
            tag: 'Map',
            name: this.name,
            images: this.images,
            positions: this.positions,
            themes: this.themes
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Map', key },
            children: [
                ...[this.name].filter(excludeUndefined).filter(({ children }) => (children.length)).map(standardFieldToOutputNode).flat(1),
                ...this.images,
                ...this.positions,
                ...this.themes
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMapPayload()
        returnValue._name = combineTaggedChildren(this.name, incoming.name) as EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>
        returnValue._images = applyEdits([...this.images, ...incoming.images])
        returnValue._positions = applyEdits([...this.positions, ...incoming.positions])
        returnValue._themes = [...this.themes, ...incoming.themes]
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return positionReferenceKeys(this.positions ?? [])
            .map((key) => ({ referenceType: 'Position', key }))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMapPayload(this)
        returnValue._name = applyTreeCallbackToNode(callback)(returnValue._name) as GenericTreeNodeFiltered<SchemaNameTag, SchemaOutputTag> | undefined
        returnValue._images = callback(returnValue._images)
        returnValue._positions = callback(returnValue._positions)
        return returnValue as this
    }
}
export class StandardMap extends componentClassFactory(StandardMapPayload, 'StandardMap') {
    get name() { return this._payload.name }
    get images() { return this._payload.images }
    get positions() { return this._payload.positions }
    get themes() { return this._payload.themes }

    override clone(): StandardMap {
        const returnValue = new StandardMap(this)
        returnValue._payload = new StandardMapPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMap(super.merge(incoming) as StandardMap)
    }

    override withUniversalKey(key: string): StandardComponent {
        return new StandardMap(super.withUniversalKey(key) as StandardMap)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMap(super.withFileName(key) as StandardMap)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardMap(super.withImport(importData) as StandardMap)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardMap(super.withExport(exportData) as StandardMap)
    }
}

export default StandardMap

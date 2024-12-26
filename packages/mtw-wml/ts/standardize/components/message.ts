import { excludeUndefined } from "../../lib/lists"
import { isSchemaDescription, isSchemaMessage, SchemaDescriptionTag, SchemaOutputTag, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses"
import { EditWrappedStandardNode } from "../baseClasses"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardMessageData } from "./dataTypes/message"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { dependencyReferenceKeys, directReferenceKeys } from "./utils/references"
import { StandardRender } from "../render"
import { extractStandardRender, rebuildSchemaFromStandardRender } from "./utils/extractStandardRender"
import { stripUIFields } from "../render/utils"
import { StandardToJSONOptions } from "./baseClasses"

export class StandardMessagePayload implements ComponentConstructorMethods<StandardMessageData> {
    _description?: StandardRender;
    _rooms: GenericTree<SchemaTag> = [];
    tag = 'Message' as const

    constructor(previous?: StandardMessagePayload) {
        if (previous) {
            this._description = previous._description
            this._rooms = [...previous._rooms]
        }
    }

    fromJSON(props: StandardMessageData) {
        this._description = extractStandardRender(props.description, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
        this._rooms = props.rooms
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMessage)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const descriptionChildren = tagTree.filter({ not: { match: 'Room' } }).tree
            const descriptionItem = descriptionChildren.length ? { data: { tag: 'Description' as const }, children: descriptionChildren } : undefined
            this._description = extractStandardRender(descriptionItem as EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>, isSchemaDescription, 'Schema mismatch in StandardMessage constructor')
            const roomTagTree = tagTree.filter({ match: 'Room' }).prune({ not: { match: 'Room' } })
            this._rooms = roomTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMessage constructor')
    }

    get description() { return rebuildSchemaFromStandardRender(this._description, { tag: 'Description' as const }) }
    get rooms() { return this._rooms }

    toJSON(options?: StandardToJSONOptions): Omit<StandardMessageData, 'key' | 'universalKey'> {
        const { stripUIFields: stripUI } = options ?? {}
        return {
            tag: 'Message',
            description: stripUI
                ? rebuildSchemaFromStandardRender(this._description?.mapContents(stripUIFields), { tag: 'Description' as const })
                : this.description,
            rooms: this.rooms
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Message', key },
            children: [
                ...this.rooms,
                ...[this.description].filter(excludeUndefined).map(({ children }) => (children)).flat(1)
            ]
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMessagePayload()
        returnValue._description = (this._description && incoming._description) ? this._description.merge(incoming._description) : this._description ?? incoming._description
        returnValue._rooms = applyEdits([...this.rooms, ...incoming.rooms])
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...directReferenceKeys(this.rooms)
                .map((key) => ({ referenceType: 'Direct' as const, key })),
            ...dependencyReferenceKeys(this.rooms)
                .map((key) => ({ referenceType: 'Dependency' as const, key }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMessagePayload(this)
        if (returnValue._description) {
            returnValue._description = returnValue._description.mapContents(callback)
        }
        returnValue._rooms = callback(returnValue._rooms)
        return returnValue as this
    }
}

export class StandardMessage extends componentClassFactory(StandardMessagePayload, 'StandardMessage') {
    get description() { return this._payload.description }
    get rooms() { return this._payload.rooms }

    override clone(): StandardMessage {
        const returnValue = new StandardMessage(this)
        returnValue._payload = new StandardMessagePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMessage(super.merge(incoming) as StandardMessage)
    }

    override withKey(key: string): StandardComponent {
        return new StandardMessage(super.withKey(key) as StandardMessage)
    }
    
    override withUniversalKey(key: string): StandardComponent {
        return new StandardMessage(super.withUniversalKey(key) as StandardMessage)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMessage(super.withFileName(key) as StandardMessage)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardMessage(super.withImport(importData) as StandardMessage)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardMessage(super.withExport(exportData) as StandardMessage)
    }

}

export default StandardMessage

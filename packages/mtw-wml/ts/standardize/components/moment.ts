import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardMomentData } from "./dataTypes/moment"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { mapReferenceToFormat, mergeUniqueReferences, ReferenceFormat } from "./utils/references"
import { ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMessage, isSchemaMoment } from "@tonylb/mtw-base/ts/schema/components"
import StandardReference, { diffStandardReferenceList, StandardKey, StandardReferenceSimple } from "./reference"
import { deepEqual } from "../../lib/objects"
import { StandardReferenceData } from "./dataTypes/reference"
import { excludeUndefined } from "../../lib/lists"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"
import { renderReference } from "./utils/schema"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData> {
    _messages: StandardReference[] = [];
    tag = 'Moment' as const

    constructor(previous?: StandardMomentPayload) {
        if (previous) {
            this._messages = previous.messages.map((message) => (message.clone()))
        }
    }

    fromJSON(props: StandardMomentData) {
        this._messages = props.messages?.map((reference) => (new StandardReference(reference))) ?? []
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMoment)(node)) {
            this._messages = node.children.filter(wrappedNodeTypeGuard(isSchemaMessage)).map((reference) => {
                if (treeNodeTypeguard(isSchemaMessage)(reference) || treeNodeTypeguard(isSchemaRemove)(reference)) {
                    return new StandardReference([reference])
                }
                throw new Error('Schema mismatch in StandardMoment constructor')
            })
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get messages() { return this._messages }

    toJSON(): Omit<StandardMomentData, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            messages: this.messages.map((reference) => (reference.toJSON() as StandardReferenceData))
        }
    }

    schema(key: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key, uuid: universalKey },
            children: this.messages.map((reference) => (reference.schema)).flat(1)
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { key } = options
        return {
            data: { tag: 'Moment', key: key.key ?? '', uuid: key.universalKey },
            children: this.messages.map(renderReference({ lookup, options })).filter(excludeUndefined).flat(1)
        }
    }
    
    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._messages = mergeUniqueReferences(this.messages, incoming.messages)
        return returnValue as this
    }

    subset(): this {
        return new StandardMomentPayload() as this
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.messages.map((reference) => ({ referenceType: 'Direct' as const, key: reference._payload.plain })),
            ...this.messages.map((reference) => ({ referenceType: 'Dependency' as const, key: reference._payload.plain })),
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }

    remapReferences(props: { mappings: { key: string; universalKey: ComponentUUID }[]; mapTo: ReferenceFormat }): this {
        const returnValue = new StandardMomentPayload(this)
        const mapReference = mapReferenceToFormat(props.mappings, props.mapTo)
        returnValue._messages = returnValue._messages.map(mapReference)
        return returnValue as this
    }
    
}

export class StandardMoment extends componentClassFactory(StandardMomentPayload, 'StandardMoment') {
    get messages() { return this._payload.messages }

    override clone(): StandardMoment {
        const returnValue = new StandardMoment(this)
        returnValue._payload = new StandardMomentPayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardMoment(super.merge(incoming) as StandardMoment)
    }

    override diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined {
        if (!(incoming instanceof StandardMoment)) {
            throw new Error('Mismatched component types in diff')
        }
        const { hasDiff } = options ?? {}
        const messagesDiff = diffStandardReferenceList({ base: this._payload._messages, incoming: incoming._payload._messages, hasDiff, parentKey: this.key })
        if (deepEqual(this.toJSON(), incoming.toJSON()) && !messagesDiff.length) {
            return undefined
        }
        const base = new StandardMoment(this.key ?? '').withImport(this.import).withExport(this.export) as StandardMoment
        base._payload._messages = messagesDiff
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardMoment(super.withKey(key) as StandardMoment)
    }
    
    override withUniversalKey(key: ComponentUUID): StandardComponent {
        return new StandardMoment(super.withUniversalKey(key) as StandardMoment)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardMoment(super.withFileName(key) as StandardMoment)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardMoment(super.withImport(importData) as StandardMoment)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardMoment(super.withExport(exportData) as StandardMoment)
    }

}

export default StandardMoment

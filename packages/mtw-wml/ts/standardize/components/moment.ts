import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { NestedSchemaOptions, StandardComponent, StandardDiffOptions } from "./baseClasses"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardMomentData } from "./dataTypes/moment"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { dependencyReferenceKeys, directReferenceKeys, mergeUniqueReferences } from "./utils/references"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaMessage, isSchemaMoment } from "@tonylb/mtw-base/ts/schema/components"
import StandardReference, { diffStandardReferenceList } from "./reference"
import { deepEqual } from "../../lib/objects"
import { StandardReferenceData } from "./dataTypes/reference"
import { excludeUndefined } from "../../lib/lists"
import { StandardRemove, StandardReplace } from "./edits"
import { wrappedNodeTypeGuard } from "../../schema/utils"
import { isSchemaRemove } from "../../schema/baseClasses"
import { SerializeNDJSONMixin } from "../baseClasses"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData> {
    _messages: (StandardReference | StandardRemove | StandardReplace)[] = [];
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
                if (treeNodeTypeguard(isSchemaMessage)(reference)) {
                    return new StandardReference(reference.data)
                }
                if (treeNodeTypeguard(isSchemaRemove)(reference)) {
                    const { children } = reference
                    if (children.length !== 1) {
                        throw new Error('Remove node must have exactly one child')
                    }
                    return new StandardRemove(new StandardReference(children[0].data))
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

    toNDJSON(): Omit<StandardMomentData & SerializeNDJSONMixin, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            messages: this.messages.map((reference) => (reference.toNDJSON() as StandardReferenceData))
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key },
            children: this.messages.map((reference) => (reference.schema))
        }
    }

    nestedSchema(byId: Record<string, StandardComponent>, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { localKey: key } = options
        return {
            data: { tag: 'Moment', key },
            children: this.messages.map((reference) => (
                    //
                    // TODO: Resurface this code in ISS-5072 when messages get a global flag
                    //
                    // reference.global
                    //     ? reference.schema
                    //     : byId[`${key}.${reference.key}`]?.nestedSchema(byId, reference.key, `${key}.${reference.key}`)
                    reference.schema
                )).filter(excludeUndefined)
        }
    }
    
    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._messages = mergeUniqueReferences(this.messages, incoming.messages)
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this.messages.map(({ key }) => ({ referenceType: 'Direct' as const, key })),
            ...this.messages.map(({ key }) => ({ referenceType: 'Dependency' as const, key }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
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
        const { hasDiff } = options ?? {}
        if (!(incoming instanceof StandardMoment)) {
            throw new Error('Mismatched component types in diff')
        }
        if (deepEqual(this.toNDJSON(), incoming.toNDJSON())) {
            return undefined
        }
        const base = new StandardMoment(this.key).withImport(this.import).withExport(this.export) as StandardMoment
        const diff = diffStandardReferenceList({ base: this._payload._messages, incoming: incoming._payload._messages, hasDiff })
        base._payload._messages = diff
        return base
    }

    override withKey(key: string): StandardComponent {
        return new StandardMoment(super.withKey(key) as StandardMoment)
    }
    
    override withUniversalKey(key: string): StandardComponent {
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

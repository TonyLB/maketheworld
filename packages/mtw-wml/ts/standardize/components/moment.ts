import { isSchemaMoment, SchemaTag } from "../../schema/baseClasses"
import applyEdits from "../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { componentClassFactory, ComponentConstructorMethods, StandardComponent } from "./component"
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData"
import { StandardMomentData } from "./dataTypes/moment"
import { StandardExportItem, StandardImportItem } from "./metaData"
import { dependencyReferenceKeys, directReferenceKeys } from "./utils/references"

export class StandardMomentPayload implements ComponentConstructorMethods<StandardMomentData> {
    _messages: GenericTree<SchemaTag> = [];
    tag = 'Moment' as const

    constructor(previous?: StandardMomentPayload) {
        if (previous) {
            this._messages = [...previous.messages]
        }
    }

    fromJSON(props: StandardMomentData) {
        this._messages = props.messages
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaMoment)(node)) {
            const tagTree = new SchemaTagTree(node.children)
            const messageTagTree = tagTree.filter({ match: 'Message' }).prune({ not: { or: [{ match: 'Message' }, { before: { match: 'Message' } }] } })
            this._messages = messageTagTree.tree
            return
        }
        throw new Error('Schema mismatch in StandardMoment constructor')
    }

    get messages() { return this._messages }

    toJSON(): Omit<StandardMomentData, 'key' | 'universalKey'> {
        return {
            tag: 'Moment',
            messages: this.messages
        }
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Moment', key },
            children: this.messages
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardMomentPayload()
        returnValue._messages = applyEdits([...this.messages, ...incoming.messages])
        return returnValue as this
    }

    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...directReferenceKeys(this.messages)
                .map((key) => ({ referenceType: 'Direct' as const, key })),
            ...dependencyReferenceKeys(this.messages)
                .map((key) => ({ referenceType: 'Dependency' as const, key }))
        ]
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        const returnValue = new StandardMomentPayload(this)
        returnValue._messages = callback(returnValue._messages)
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

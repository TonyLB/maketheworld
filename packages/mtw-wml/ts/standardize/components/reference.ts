import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { defaultComponentFromTag } from "../baseClasses";
import { componentClassFactory, ComponentConstructorMethods } from "./component"
import { StandardComponent } from "./baseClasses"
import { isStandardFeature, StandardComponentNonEditData } from "./dataTypes"
import { StandardFeatureData } from "./dataTypes/feature";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { StandardExportItem, StandardImportItem } from "./metaData";
import { isSchemaComponent, isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema";
import { isSchemaFeature, SchemaFeatureTag } from "@tonylb/mtw-base/ts/schema/components";
import { ComponentTag } from "./dataTypes/abstract";
import { StandardRemove, StandardReplace } from "./edits";
import { StandardReferenceData } from "./dataTypes/reference";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize";
import { unique } from "../../list";
import { excludeUndefined } from "../../lib/lists";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit";
import { deepEqual } from "../../lib/objects";

export class StandardReferencePayload implements ComponentConstructorMethods<StandardReferenceData> {
    tag: ComponentTag = 'Room';
    _global?: boolean;

    constructor(previous?: StandardReferencePayload) {
        if (previous) {
            this.tag = previous.tag
            this._global = previous.global
        }
    }

    fromJSON(props: StandardReferenceData) {
        this.tag = props.tag
        this._global = props.global
    }

    fromSchema(node: GenericTreeNode<SchemaTag>) {
        if (treeNodeTypeguard(isSchemaFeature)(node)) {
            this._global = node.data.global
        }
        if (treeNodeTypeguard(isSchemaComponent)(node)) {
            this.tag = node.data.tag
            return
        }
        throw new Error('Schema mismatch in StandardReference constructor')
    }

    get global() { return this._global }

    toJSON(): Omit<StandardComponentNonEditData, 'key' | 'universalKey'> {
        const defaultTag = defaultComponentFromTag(this.tag, '')
        const { key, ...rest } = defaultTag
        if (isStandardFeature(defaultTag)) {
            return { ...rest, global: this._global } as Omit<StandardFeatureData, 'key' | 'universalKey'>
        }
        return rest
    }

    schema(key: string): GenericTreeNode<SchemaTag> {
        if (this.tag === 'Character') {
            throw new Error('Character, Asset and Story references are not allowed in StandardReference')
        }
        if (this.tag === 'Feature') {
            return {
                data: { tag: this.tag, global: this._global, key } as SchemaFeatureTag,
                children: []
            }
        }
        return {
            data: { tag: this.tag, key } as SchemaTag,
            children: []
        }
    }

    merge(incoming: this): this {
        const returnValue = new StandardReferencePayload(this)
        if (incoming.global) {
            returnValue._global = true
        }
        return returnValue as this
    }
    
    referencedKeys(): { key: string; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency"; }[] {
        return []
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this {
        return this
    }
}

export class StandardReference extends componentClassFactory(StandardReferencePayload, 'StandardReference') {

    override get global() { return this._payload.global }

    override clone(): StandardReference {
        const returnValue = new StandardReference(this)
        returnValue._payload = new StandardReferencePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardReference(super.merge(incoming) as StandardReference)
    }

    override withKey(key: string): StandardComponent {
        return new StandardReference(super.withKey(key) as StandardReference)
    }
    
    override withUniversalKey(key: string): StandardComponent {
        return new StandardReference(super.withUniversalKey(key) as StandardReference)
    }

    override withFileName(key: string): StandardComponent {
        return new StandardReference(super.withFileName(key) as StandardReference)
    }

    override withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent {
        return new StandardReference(super.withImport(importData) as StandardReference)
    }

    override withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent {
        return new StandardReference(super.withExport(exportData) as StandardReference)
    }

}

// 
// Computes the difference between two lists of  editable `StandardReference` objects.
// 
type DiffStandardReferenceListParams = {
    base: (StandardReference | StandardRemove | StandardReplace)[];
    incoming: (StandardReference | StandardRemove | StandardReplace)[];
    hasDiff?: (key: string) => boolean;
}
export const diffStandardReferenceList = ({ base, incoming }: DiffStandardReferenceListParams): (StandardReference | StandardRemove | StandardReplace)[] => {
    const diffReference = (baseReference: StandardReference | StandardRemove | StandardReplace | undefined, incomingReference: StandardReference | StandardRemove | StandardReplace | undefined): StandardReference | StandardRemove | StandardReplace | undefined => {
        if (baseReference) {
            if (!incomingReference) {
                if (baseReference instanceof StandardRemove) {
                    const match = baseReference._match
                    if (match instanceof StandardReference) {
                        return match
                    }
                    else {
                        throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
                    }
                }
                if (baseReference instanceof StandardReplace) {
                    return new StandardReplace(baseReference._payload, baseReference._match)
                }
                return new StandardRemove(baseReference)
            }
            if (baseReference.key !== incomingReference.key) {
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (baseReference instanceof StandardReference) {
                if (incomingReference instanceof StandardReference) {
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (baseReference instanceof StandardRemove) {
                if (incomingReference instanceof StandardRemove) {
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
            if (baseReference instanceof StandardReplace) {
                if (incomingReference instanceof StandardReplace) {
                    return undefined
                }
                throw new MergeConflictError('Mismatched references in diffStandardReferenceList')
            }
        }
        else {
            return incomingReference
        }
    }
    const allKeys = unique([...base.map(reference => reference.key), ...incoming.map(reference => reference.key)])
    return allKeys.map(key => diffReference(base.find(reference => reference.key === key), incoming.find(reference => reference.key === key))).filter(excludeUndefined) as (StandardReference | StandardRemove | StandardReplace)[]
}

export const editableReferenceFactory = (node: GenericTreeNode<SchemaTag>): StandardReference | StandardRemove | StandardReplace => {
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        const { children } = node
        if (children.length !== 1) {
            throw new Error('Remove node must have exactly one child')
        }
        const referenceSchema = children[0]
        if (!treeNodeTypeguard(isSchemaComponent)(referenceSchema)) {
            throw new Error('Remove node must have a component child')
        }
        return new StandardRemove(new StandardReference(referenceSchema))
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const { children } = node
        if (children.length !== 2) {
            throw new Error('Replace node must have exactly two children')
        }
        const matchSchema = children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payloadSchema = children.find(child => treeNodeTypeguard(isSchemaReplacePayload)(child))
        if (!(matchSchema && payloadSchema)) {
            throw new Error('Replace node must have match and payload children')
        }
        const baseSchema = matchSchema.children[0]
        const incomingSchema = payloadSchema.children[0]
        if (!treeNodeTypeguard(isSchemaComponent)(baseSchema) || !treeNodeTypeguard(isSchemaComponent)(incomingSchema)) {
            throw new Error('Replace node must have component children')
        }
        const base = new StandardReference(baseSchema)
        const incoming = new StandardReference(incomingSchema)
        if (deepEqual(base.toNDJSON(), incoming.toNDJSON())) {
            return base
        }
        return new StandardReplace(new StandardReference(baseSchema), new StandardReference(incomingSchema))
    }
    if (treeNodeTypeguard(isSchemaComponent)(node)) {
        return new StandardReference(node)
    }
    throw new Error('Schema mismatch in editableReferenceFactory')
}

export default StandardReference

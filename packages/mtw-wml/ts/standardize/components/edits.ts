import { deepEqual } from "../../lib/objects";
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { NestedSchemaOptions, StandardComponent } from "./baseClasses";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./dataTypes";
import { removeNDJSONOnlyProperties } from "../utils";
import { AssetUUID, ComponentUUID, isSchemaComponentTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { ComponentTag } from "./dataTypes/abstract";
import { ReferenceFormat } from "./utils/references";
import { StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { StandardKey } from "./reference";

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardRemove implements StandardComponent {
    _key: StandardKey;
    _mapping?: StandardKey[];
    _match: StandardComponent;
    tag: ComponentTag | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: StandardRemove | StandardComponent) {
        if (props instanceof StandardRemove) {
            this._key = props._key
            this._match = props._match.clone()
            return
        }
        const tag = props.tag
        if (!isSchemaComponentTag(tag)) {
            throw new Error(`Invalid tag provided to StandardRemove constructor: ${tag}`)
        }
        this._key = new StandardKey(props._key)
        this._match = props as StandardComponent
        return
    }

    withMapping(mapping: StandardKey[]): this {
        const returnValue = new StandardRemove(this)
        returnValue._mapping = mapping
        return returnValue as this
    }
    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return undefined }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return this._match.referencedKeys()
    }

    clone(): StandardRemove {
        return new StandardRemove(this)
    }

    get referenceData(): StandardReferenceData {
        if (this.universalKey && !this.key) {
            return this.universalKey
        }
        return {
            tag: this._match.tag as ComponentTag,
            key: this.key,
            universalKey: this.universalKey,
        }
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardRemove {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.mapContents(callback)
        return returnValue
    }

    remapReferences(mapTo): StandardRemove {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.withMapping(this._mapping ?? []).remapReferences(mapTo)
        return returnValue
    }

    toJSON(): StandardRemoveData {
        return {
            key: this.key,
            tag: 'Remove',
            component: this._match.toJSON() as StandardComponentNonEditData
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Remove' },
            children: [this._match.schema]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        const { removeContext } = options
        if (removeContext) {
            return this._match.nestedSchema(lookup, options)
        }
        return {
            data: { tag: 'Remove' },
            children: [this._match.nestedSchema(lookup, { ...options, key: new StandardKey({ tag: this._match.tag as ComponentTag, key: this._match.key, universalKey: this._match.universalKey }), removeContext: true })]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        throw new Error('StandardRemove types cannot be directly merged')
    }

    diff(incoming: StandardComponent): StandardComponent | undefined {
        return undefined
    }

    subset(request): StandardComponent {
        return new StandardRemove(this._match.subset(request))
    }

    withKey(key: string): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withKey(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withUniversalKey(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withFileName(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withImport(fromAsset: AssetUUID): StandardComponent {
        const returnValue = this.clone()
        returnValue._match._from = fromAsset
        return returnValue
    }

    withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
        const returnValue = this.clone()
        returnValue._match._key.context = leastCommonContext
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withChild(): StandardComponent {
        return this.clone()        
    }
}

//
// StandardReplace class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
// StandardReplace class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
export class StandardReplace implements StandardComponent {
    _key: StandardKey;
    _match: StandardComponent;
    _payload: StandardComponent;
    _mapping?: StandardKey[];
    leastCommonContext: StandardKey[] = [];
    tag: ComponentTag | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(...propsArray: [StandardReplace] | [StandardComponent, StandardComponent]) {
        if (propsArray.length > 1) {
            const match = propsArray[0] as StandardComponent
            const payload = propsArray[1] as StandardComponent
            if (!(match.key === payload.key && match.tag === payload.tag)) {
                throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
            }
            this._match = match
            this._payload = payload
            const tag = match.tag
            if (!isSchemaComponentTag(tag)) {
                throw new Error(`Invalid tag provided to StandardReplace constructor: ${tag}`)
            }
            this._key = new StandardKey(match._key)
            return
        }
        const [props] = propsArray as [string | StandardReplaceData | GenericTreeNode<SchemaTag> | StandardReplace]
        if (props instanceof StandardReplace) {
            this._key = props._key
            this._match = props._match.clone()
            this._payload = props._payload.clone()
            return
        }
        throw new Error('StandardReplace constructor called with invalid arguments')
    }

    withMapping(mapping: StandardKey[]): this {
        const returnValue = new StandardReplace(this)
        returnValue._mapping = mapping
        return returnValue as this
    }
    get key() { return this._key.key }
    get universalKey() { return this._key.universalKey }
    get fileName() { return undefined }

    withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
        const returnValue = this.clone()
        returnValue._match._key.context = leastCommonContext
        returnValue._payload._key.context = leastCommonContext
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    clone(): StandardReplace {
        return new StandardReplace(this)
    }

    get referenceData(): StandardReferenceData {
        if (this.universalKey && !this.key) {
            return this.universalKey
        }
        return {
            tag: this._match.tag as ComponentTag,
            key: this.key,
            universalKey: this.universalKey,
        }
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardReplace {
        const returnValue = new StandardReplace(this)
        returnValue._match = returnValue._match.mapContents(callback)
        returnValue._payload = returnValue._payload.mapContents(callback)
        return returnValue
    }

    remapReferences(mapTo: ReferenceFormat): StandardReplace {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.withMapping(this._mapping ?? []).remapReferences(mapTo)
        returnValue._payload = returnValue._payload.withMapping(this._mapping ?? []).remapReferences(mapTo)
        return returnValue
    }

    toJSON(): StandardReplaceData {
        return {
            key: this.key,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData,
            payload: this._payload.toJSON() as StandardComponentNonEditData
        }
    }

    get schema(): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.schema] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.schema] }
            ]
        }
    }

    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.nestedSchema(lookup, options)] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.nestedSchema(lookup, options)] }
            ]
        }
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!(deepEqual(removeNDJSONOnlyProperties(this._payload.toJSON()), removeNDJSONOnlyProperties(incoming._match.toJSON())))) {
            throw new MergeConflictError()
        }
        return new StandardReplace(this, incoming._payload).withUniversalKey(this.universalKey)
    }

    diff(incoming: StandardComponent): StandardComponent | undefined {
        return undefined
    }

    subset(request): StandardComponent {
        const returnValue = new StandardReplace(this)
        returnValue._match = this._match.subset(request)
        returnValue._payload = this._payload.subset(request)
        return returnValue
    }

    referencedKeys(): { key: StandardKey; referenceType: "Link" | "Position" | "Exit" | "Direct" | "Dependency" }[] {
        return [
            ...this._match.referencedKeys(),
            ...this._payload.referencedKeys()
        ]
    }

    withKey(key: string): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withKey(key)
        returnValue._payload = this._payload.withKey(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withUniversalKey(key: ComponentUUID | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withUniversalKey(key)
        returnValue._payload = this._payload.withUniversalKey(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withFileName(key: string | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = this._match.withFileName(key)
        returnValue._payload = this._payload.withFileName(key)
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }

    withImport(fromAsset: AssetUUID): StandardComponent {
        const returnValue = this.clone()
        returnValue._match._from = fromAsset
        returnValue._payload._from = fromAsset
        return returnValue
    }


    withChild(): StandardComponent {
        return this.clone()        
    }
}

export const mergeWithEdits = (base: StandardComponent, incomingComponent: StandardComponent): StandardComponent | undefined => {
    //
    // Branch out to the several possible cases of combining edit tags and/or content
    //
    if (base) {
        if (incomingComponent) {
            if (base instanceof StandardRemove) {
                if (incomingComponent instanceof StandardRemove) {
                    throw new Error('StandardRemove types cannot be directly merged')
                }
                if (incomingComponent instanceof StandardReplace) {
                    throw new MergeConflictError()
                }
                //
                // A remove operation followed by an add should be merged into a Replace
                //
                return new StandardReplace(base._match, incomingComponent)
            }
            else if (base instanceof StandardReplace) {
                //
                // A replace followed by a remove should be merged into a remove of the original content
                //
                if (incomingComponent instanceof StandardRemove) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return new StandardRemove(base._match)
                }
                //
                // Two replace operations should be merged into a single chained operation
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base._payload.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return new StandardReplace(base._match, incomingComponent._payload)
                }
                //
                // A replace operation followed by more content should be merged to a replace with combined payload
                //
                const mergedPayload = base._payload.merge(incomingComponent)
                if (!mergedPayload) {
                    throw new MergeConflictError()
                }
                return new StandardReplace(base._match, mergedPayload)
            }
            else {
                //
                // Remove should evaluate the match and then remove the relevant component
                //
                if (incomingComponent instanceof StandardRemove) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return undefined
                }
                //
                // Replace should evaluate the match and then replace the relevant component
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!deepEqual(removeNDJSONOnlyProperties(base.toJSON()), removeNDJSONOnlyProperties(incomingComponent._match.toJSON()))) {
                        throw new MergeConflictError()
                    }
                    return incomingComponent._payload
                }
                return base.merge(incomingComponent as any)
            }
        }
        else {
            return base
        }
    }
    else {
        return incomingComponent
    }
}

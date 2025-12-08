import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { NestedSchemaOptions, StandardComponent } from "./baseClasses";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./dataTypes";
import { AssetUUID, ComponentUUID, isSchemaComponentTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { ComponentTag } from "./dataTypes/abstract";
import { ReferenceFormat } from "./utils/references";
import { StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { StandardKey, StandardReferenceRemove, StandardReferenceReplace } from "./reference";
import { StandardExplicitParent } from "../explicit";

//
// StandardRemove class provides a class that contains a matching StandardComponent to be removed. Note that merge
// methods at this level do NOT contain the functionality to handle component-level edits ... that is included
// at the StandardForm level, rather than on the individual component classes.
//
export class StandardRemove implements StandardComponent {
    _key: StandardKey;
    _mapping?: StandardKey[];
    _match: StandardComponent;
    explicitParent?: StandardExplicitParent;
    _implicitParent?: StandardKey;
    tag: ComponentTag | 'Remove' | 'Replace' = 'Remove' as const;
    constructor(props: StandardRemove | StandardComponent) {
        if (props instanceof StandardRemove) {
            this._key = props._key
            this._match = props._match.clone()
            this.explicitParent = props.explicitParent
            this._implicitParent = props._implicitParent ? new StandardKey(props._implicitParent) : undefined
            return
        }
        const tag = props.tag
        if (!isSchemaComponentTag(tag)) {
            throw new Error(`Invalid tag provided to StandardRemove constructor: ${tag}`)
        }
        this._key = new StandardKey(props._key)
        this._match = props as StandardComponent
        this.explicitParent = props.explicitParent
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
        // Extract tag from the underlying component (filter out 'Remove' wrapper tag)
        const componentTag = this._match.tag === 'Remove' || this._match.tag === 'Replace' 
            ? undefined 
            : this._match.tag as ComponentTag
        if (!componentTag) {
            throw new Error('StandardRemove referenceData requires a component tag')
        }
        if (!this.key) {
            if (!this.universalKey) {
                throw new Error('StandardRemove referenceData requires a key or universalKey')
            }
            return this.universalKey
        }
        return {
            tag: componentTag,
            key: this.key,
            universalKey: this.universalKey,
        }
    }

    get reference(): StandardReference {
        // Extract tag from the underlying component (filter out 'Remove' wrapper tag)
        const componentTag = this._match.tag === 'Remove' || this._match.tag === 'Replace' 
            ? undefined 
            : this._match.tag as ComponentTag
        if (!componentTag) {
            throw new Error('Cannot create StandardReferenceRemove reference without component tag')
        }
        return new StandardReference(new StandardReferenceRemove(this._match._key, componentTag))
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardRemove {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.mapContents(callback)
        return returnValue
    }

    remapReferences(mapTo): StandardRemove {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.withMapping(this._mapping ?? []).remapReferences(mapTo)
        returnValue._implicitParent = this._implicitParent ? this._implicitParent.toFormat(mapTo) : undefined
        return returnValue
    }

    toJSON(): StandardRemoveData {
        return {
            key: this.key,
            universalKey: this.universalKey,
            tag: 'Remove',
            component: this._match.toJSON() as StandardComponentNonEditData,
            ...(this._implicitParent ? { implicitParent: this._implicitParent.toJSON() } : {}),
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
        // When rendering Remove, preserve the incoming parent context (Remove doesn't introduce a new parent)
        // The match component's key is used for rendering, but parent context flows through unchanged
        // The match component itself will pass its key as parent to its children (see componentClassFactory nestedSchema)
        const matchKey = new StandardKey(this._match._key)
        return {
            data: { tag: 'Remove' },
            children: [this._match.nestedSchema(lookup, { ...options, key: matchKey, removeContext: true })]
        }
    }

    equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardRemove)) {
            return false
        }
        return this._match.equals(incoming._match)
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

    withChild(): StandardComponent {
        return this.clone()        
    }

    withOrigin(origin: AssetUUID[] | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.withOrigin(origin)
        return returnValue
    }

    get implicitParent(): StandardKey | undefined { return this._implicitParent }

    withImplicitParent(implicitParent: StandardKey | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._implicitParent = implicitParent ? new StandardKey(implicitParent) : undefined
        returnValue._match = returnValue._match.withImplicitParent(implicitParent)
        return returnValue
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
    explicitParent?: StandardExplicitParent;
    _implicitParent?: StandardKey;
    tag: ComponentTag | 'Remove' | 'Replace' = 'Replace' as const;
    constructor(...propsArray: [StandardReplace] | [StandardComponent, StandardComponent]) {
        if (propsArray.length > 1) {
            const match = propsArray[0] as StandardComponent
            const payload = propsArray[1] as StandardComponent
            if (match.tag !== payload.tag || (match.universalKey && payload.universalKey && match.universalKey !== payload.universalKey)) {
                throw new Error('Match and payload mistmatch in StandardReplace constructor call.')
            }
            this._match = match
            this._payload = payload
            const tag = match.tag
            if (!isSchemaComponentTag(tag)) {
                throw new Error(`Invalid tag provided to StandardReplace constructor: ${tag}`)
            }
            this._key = new StandardKey(match._key)
            // Use explicitParent from match if available, otherwise from payload
            this.explicitParent = match.explicitParent ?? payload.explicitParent
            return
        }
        const [props] = propsArray as [string | StandardReplaceData | GenericTreeNode<SchemaTag> | StandardReplace]
        if (props instanceof StandardReplace) {
            this._key = props._key
            this._match = props._match.clone()
            this._payload = props._payload.clone()
            this.explicitParent = props.explicitParent
            this._implicitParent = props._implicitParent ? new StandardKey(props._implicitParent) : undefined
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

    clone(): StandardReplace {
        return new StandardReplace(this)
    }

    get referenceData(): StandardReferenceData {
        // Extract tag from the underlying payload component (filter out 'Remove'/'Replace' wrapper tags)
        const componentTag = this._payload.tag === 'Remove' || this._payload.tag === 'Replace'
            ? undefined
            : this._payload.tag as ComponentTag
        if (!componentTag) {
            throw new Error('StandardReplace referenceData requires a component tag')
        }
        if (!this.key) {
            if (!this.universalKey) {
                throw new Error('StandardReplace referenceData requires a key or universalKey')
            }
            return this.universalKey
        }
        return {
            tag: componentTag,
            key: this.key,
            universalKey: this.universalKey,
        }
    }

    get reference(): StandardReference {
        // Extract tag from the underlying payload component (filter out 'Remove'/'Replace' wrapper tags)
        const componentTag = this._payload.tag === 'Remove' || this._payload.tag === 'Replace'
            ? undefined
            : this._payload.tag as ComponentTag
        if (!componentTag) {
            throw new Error('Cannot create StandardReferenceReplace reference without component tag')
        }
        return new StandardReference(new StandardReferenceReplace(this._match._key, this._payload._key, componentTag))
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
        returnValue._implicitParent = this._implicitParent ? this._implicitParent.toFormat(mapTo) : undefined
        return returnValue
    }

    toJSON(): StandardReplaceData {
        return {
            key: this.key,
            universalKey: this.universalKey,
            tag: 'Replace',
            match: this._match.toJSON() as StandardComponentNonEditData,
            payload: this._payload.toJSON() as StandardComponentNonEditData,
            ...(this._implicitParent ? { implicitParent: this._implicitParent.toJSON() } : {}),
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
        // When rendering Replace, preserve the incoming parent context (Replace doesn't introduce a new parent)
        // The match/payload component keys are used for rendering, but parent context flows through unchanged
        // Each component itself will pass its key as parent to its children (see componentClassFactory nestedSchema)
        const matchKey = new StandardKey(this._match._key)
        const payloadKey = new StandardKey(this._payload._key)
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [this._match.nestedSchema(lookup, { ...options, key: matchKey })] },
                { data: { tag: 'ReplacePayload' }, children: [this._payload.nestedSchema(lookup, { ...options, key: payloadKey })] }
            ]
        }
    }

    equals(incoming: StandardComponent): boolean {
        if (!(incoming instanceof StandardReplace)) {
            return false
        }
        return this._match.equals(incoming._match) && this._payload.equals(incoming._payload)
    }

    merge(incoming: StandardComponent): StandardComponent | undefined {
        if (!(incoming instanceof StandardReplace)) {
            throw new Error('Type mismatch in StandardReplace merge')
        }
        if (!this._payload.equals(incoming._match)) {
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

    withOrigin(origin: AssetUUID[] | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._match = returnValue._match.withOrigin(origin)
        returnValue._payload = returnValue._payload.withOrigin(origin)
        return returnValue
    }

    get implicitParent(): StandardKey | undefined { return this._implicitParent }

    withImplicitParent(implicitParent: StandardKey | undefined): StandardComponent {
        const returnValue = this.clone()
        returnValue._implicitParent = implicitParent ? new StandardKey(implicitParent) : undefined
        returnValue._match = returnValue._match.withImplicitParent(implicitParent)
        returnValue._payload = returnValue._payload.withImplicitParent(implicitParent)
        return returnValue
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
                    if (!base._payload.equals(incomingComponent._match)) {
                        throw new MergeConflictError()
                    }
                    return new StandardRemove(base._match)
                }
                //
                // Two replace operations should be merged into a single chained operation
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!base._payload.equals(incomingComponent._match)) {
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
                    if (!base.equals(incomingComponent._match)) {
                        throw new MergeConflictError()
                    }
                    return undefined
                }
                //
                // Replace should evaluate the match and then replace the relevant component
                //
                if (incomingComponent instanceof StandardReplace) {
                    if (!base.equals(incomingComponent._match)) {
                        console.log(`Merge conflict in mergeWithEdits: base=${JSON.stringify(base.toJSON(), null, 2)}, incoming=${JSON.stringify(incomingComponent.toJSON(), null, 2)}`)
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

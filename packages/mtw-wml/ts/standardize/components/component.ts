//
// The componentClassFactory class function accepts a payload class that implements
// the ComponentConstructorMethods interface, and returns a class suitable for
// use as a StandardComponent, with key and payload subsections.
//
// The payload class is assumed to *ignore* incoming constructor arguments,
// and to always (initially) create a default object of the relevant type.
// Accepting incoming arguments should occur in the constructor methods,
// which are called by the componentClassFactory wrapper function.
//
// NOTE: For easy access, the returned class should then be extended with getter
// functions to pull data out of the private payload.
//

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { isLegalKey } from "../utils";
import { NestedSchemaOptions, StandardComponent, StandardComponentReferenceKey, StandardToJSONOptions } from "./baseClasses";
import { ComponentKey } from "./dataTypes/key"
import { isSchemaTreeNode, nodeFromWML } from "../../schema";
import { AssetUUID, ComponentUUID, isSchemaComponent, isSchemaComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { deepEqual } from "../../lib/objects";
import { StandardComponentData, StandardComponentInputData, StandardFormSubsetRequest } from "../baseClasses";
import { ReferenceFormat } from "./utils/references";
import { isStandardReferenceData, StandardReferenceData } from "./dataTypes/reference";
import StandardReference from "../keys/reference";
import { StandardKey } from "../keys/key";
import { StandardExplicitParent, StandardExplicitKey, StandardExplicitKeyPlain, StandardExplicitKeyRemove, StandardExplicitKeyReplace } from "../explicit";
import { splitTaggedChildren } from "../../schema/utils";
import {
    resolveStandardizeFromSchemaContext,
    type StandardFormConstructionOptions,
    type StandardizeFromSchemaContext,
} from "../wmlStandardizeMode";
import { StandardLiteral } from "../literal";

export interface AssureReferencesResult<T> {
    payload: T
    inlineRemainder: StandardReference[]
}

export type ComponentConstructorMethodsDiff<D extends ComponentKey> = {
    action: 'Replace';
} | {
    action: 'Edit';
    payload: D;
}

export interface ComponentConstructorMethods<DInput, DOutput> {
    fromJSON(line: DInput): void;
    fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag>;
    subset(options: StandardFormSubsetRequest): this;
    merge(incoming: this): this;
    toJSON(options?: StandardToJSONOptions): Omit<DOutput, 'key' | 'universalKey'>;
    schema(key?: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag>;
    nestedSchema?(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag>;
    tag: ComponentTag;
    referencedKeys(mapping: StandardReference[]): StandardComponentReferenceKey[];
    remapReferences?: (props: { mappings: StandardReference[], mapTo: ReferenceFormat }) => this;
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this;
    withChild?(child: StandardReference): this;
    invert?(): this;
    /**
     * Assures that the given child references exist in the appropriate buckets with ref={0} if needed.
     * Returns payload with buckets updated and inlineRemainder (references not mapping to any bucket).
     * See AGENT.implementation.md for detailed documentation.
     */
    assureReferences?(children: StandardReference[]): AssureReferencesResult<this>;
    /**
     * Removes matching references from the component's reference lists.
     */
    removeReferences?(references: StandardReference[]): this;
    isEmpty?(): boolean;
}

//
// componentClassFactory is explicitly bi-typed:
// - DInput: permissive ingest shape accepted by fromJSON/constructors
// - DOutput: normative serialized shape emitted by toJSON
//
export const componentClassFactory = <
    DInput extends StandardComponentInputData,
    DOutput extends StandardComponentData,
    TBase extends new (...args: any[]) => ComponentConstructorMethods<DInput, DOutput>
>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key?: StandardExplicitKey;
        _universalKey?: ComponentUUID;
        _mapping?: StandardReference[];
        _payload: InstanceType<typeof Base>;
        _from?: AssetUUID;
        _origin?: AssetUUID[];
        explicitParent?: StandardExplicitParent;
        constructor(
            props: string | DInput | GenericTreeNode<SchemaTag> | GeneratedComponentClass,
            options?: StandardFormConstructionOptions,
        ) {
            this._payload = new Base() as InstanceType<typeof Base>
            //
            // Default-construction path: allow callers to create an "empty" component whose payload
            // is just the Base default. This is used in the two-remainder pipeline to construct a
            // component and then populate it via fromSchema(node) while also obtaining a child
            // remainder. For existing call sites that always pass a props argument, this branch
            // is never taken.
            //
            if (props === undefined) {
                return
            }
            if (props instanceof GeneratedComponentClass) {
                this._universalKey = props._universalKey
                this._key = props._key ? new StandardExplicitKey(props._key) : undefined
                this._payload = props._payload
                this._from = props._from
                this._origin = props._origin
                this._mapping = props._mapping?.map(ref => new StandardReference(ref))
                // Clone explicitParent if it exists - use constructor to clone (preserves ASSET sentinel)
                this.explicitParent = props.explicitParent ? new StandardExplicitParent(props.explicitParent) : undefined
                return
            }
            if (typeof props === 'string' && isLegalKey(props)) {
                this._key = new StandardExplicitKey(props)
                this._universalKey = undefined
                return
            }
            if (typeof props === 'string' && isSchemaComponentUUID(props)) {
                this._universalKey = props
                return
            }
            if (isSchemaTreeNode(props) || typeof props === 'string') {
                const node = typeof props === 'string'
                    ? nodeFromWML(props)
                    : props
                this.fromSchema(
                    node,
                    resolveStandardizeFromSchemaContext(
                        options?.standardizeMode !== undefined
                            ? { standardizeMode: options.standardizeMode }
                            : undefined,
                    ),
                )
                return
            }
            this._universalKey = props.universalKey
            // Create _key from key if present (key can be string or StandardEditableData<string>)
            if (props.key !== undefined) {
                this._key = new StandardExplicitKey(props.key)
            }
            this._from = (props as any).from
            this._origin = (props as any).origin
            this._payload.fromJSON(props)
            // Backwards compatibility: silently ignore implicitParent if present in JSON
            // (it's no longer used, but old data may still contain it)
        }

        //
        // Component-level fromSchema: shared schema-node handling for all components.
        // Side-effects this instance (wrapper fields and payload) and returns a child
        // remainder from the payload's fromSchema pipeline (currently always empty for
        // components that don't expose child schema to processComponents).
        //
        fromSchema(node: GenericTreeNode<SchemaTag>, context?: StandardizeFromSchemaContext): GenericTree<SchemaTag> {
            const resolvedContext = resolveStandardizeFromSchemaContext(context)
            if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                throw new Error(`Invalid schema node type in ${label} constructor call: ${node.data.tag}`)
            }
            this._universalKey = 'uuid' in node.data ? node.data.uuid : undefined
            this._from = node.data.from
            this._origin = 'origin' in node.data ? node.data.origin : undefined
            //
            // Extract Key and Parent tags from direct children using splitTaggedChildren.
            // splitTaggedChildren respects Remove/Replace semantics and avoids recursing into
            // nested components, matching the previous SchemaTagTree-based behavior.
            //
            const { matched: keyNodes, remainder: withoutKey } = splitTaggedChildren({
                children: node.children,
                tag: 'Key',
            })
            if (keyNodes.length > 0) {
                // Always create StandardExplicitKey if Key tag exists
                this._key = new StandardExplicitKey(keyNodes)
            } else if (node.data.key) {
                // Convert key attribute to explicitKey
                this._key = new StandardExplicitKey(node.data.key)
            }
            const { matched: parentNodes, remainder: childrenWithoutParentAndKey } = splitTaggedChildren({
                children: withoutKey,
                tag: 'Parent',
            })
            if (parentNodes.length > 0) {
                // Always create StandardExplicitParent if Parent tag exists (even if empty)
                this.explicitParent = new StandardExplicitParent(parentNodes)
            }
            // Create a node without Parent and Key tags for payload processing
            const nodeWithoutParentAndKey = {
                ...node,
                children: childrenWithoutParentAndKey
            }
            return this._payload.fromSchema(nodeWithoutParentAndKey, resolvedContext)
        }

        _wrap(instance: GeneratedComponentClass): this {
            return instance as this
        }

        withMapping(mapping: StandardReference[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._mapping = mapping
            return this._wrap(returnValue)
        }
        get key(): string | undefined {
            if (!this._key) return undefined
            const payload = this._key.payload
            if (!payload) return undefined
            if (payload instanceof StandardExplicitKeyPlain) {
                return payload.plain?.key ?? ''
            }
            if (payload instanceof StandardExplicitKeyRemove) {
                return (payload as any).match?.key ?? ''
            }
            if (payload instanceof StandardExplicitKeyReplace) {
                return (payload as any).match?.key ?? ''
            }
            return undefined
        }
        get universalKey(): ComponentUUID | undefined { return this._universalKey }
        get standardKey(): StandardKey {
            const localKey = this.key  // Reads from _key
            const universalKey = this._universalKey
            if (localKey) {
                return new StandardKey({ key: localKey, universalKey })
            }
            if (universalKey) {
                return new StandardKey(universalKey)
            }
            throw new Error('StandardComponent.standardKey requires either _key or _universalKey to be set')
        }
        withStandardKey(key: StandardKey): this {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._universalKey = key.universalKey
            if (key.key) {
                returnValue._key = new StandardExplicitKey(key.key)
            }
            return this._wrap(returnValue)
        }
        get fileName(): string | undefined { return undefined }
        get tag(): ComponentTag { return this._payload.tag }
        get shortName(): StandardLiteral | undefined {
            return (this._payload as { shortName?: StandardLiteral }).shortName
        }
        get referenceData(): StandardReferenceData {
            if (!this.key) {
                if (!this.universalKey) {
                    throw new Error('StandardComponent referenceData requires a key or universalKey')
                }
                return this.universalKey
            }
            return {
                tag: this.tag,
                key: this.key,
                universalKey: this.universalKey,
            }
        }
        get reference(): StandardReference {
            return new StandardReference(this.referenceData)
        }
        get origin(): AssetUUID[] | undefined { return this._origin }

        clone(): StandardComponent {
            return this._wrap(new GeneratedComponentClass(this))
        }

        mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._payload = returnValue._payload.mapContents(callback)
            return this._wrap(returnValue)
        }

        remapReferences(mapTo: ReferenceFormat): this {
            if (this._payload.remapReferences) {
                const returnValue = this.clone() as GeneratedComponentClass
                returnValue._payload = returnValue._payload.remapReferences?.({ mapTo, mappings: this._mapping ?? [] }) ?? returnValue._payload
                return this._wrap(returnValue)
            }
            return this
        }

        toJSON(options?: StandardToJSONOptions): DOutput {
            return {
                key: this._key?.toJSON(),  // Returns string for Simple, StandardEditableData<string> for Remove/Replace
                universalKey: this.universalKey,
                ...this._payload.toJSON(options),
                ...(this._from ? { from: this._from } : {}),
                ...(this._origin ? { origin: this._origin } : {}),
                ...(this.explicitParent ? { explicitParent: this.explicitParent.toJSON() } : {}),
            } as DOutput
        }

        get schema(): GenericTreeNode<SchemaTag> {
            const payload = this._payload.schema(this.key, this._universalKey, this._mapping)
            if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
            }
            // Add Key tag to children if _key exists AND is NOT Simple (for Remove/Replace edit semantics)
            // Add Parent tag to children if explicitParent is defined (after Key tag)
            let children = [...payload.children]
            if (this._key) {
                const keyJSON = this._key.toJSON()
                // If toJSON returns a string, it's Simple (don't add Key tag to children)
                // If toJSON returns an object, it's Remove/Replace (add Key tag to children)
                if (keyJSON && typeof keyJSON !== 'string' && this._key.schema.length > 0) {
                    children = [this._key.schema[0], ...children]
                }
            }
            if (this.explicitParent && this.explicitParent.schema.length > 0) {
                children = [this.explicitParent.schema[0], ...children]
            }
            return { ...payload, data: { ...payload.data, from: this._from, origin: this._origin }, children }
        }

        nestedSchema(lookup: (value: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {

            const { removeContext } = options

            const target = removeContext ? this.invert() as this : this
            
            // Check if component should be rendered based on its parent context using OrganizationContext helper
            // If no organization is provided, always render (default behavior)
            // If organization is provided, only render if it's in parent context
            const targetStandardKey = target.standardKey
            const shouldRender = !options.organization || options.organization.isParentContext(targetStandardKey, options.parent)
            
            if (!shouldRender) {
                const reference = new StandardReference(targetStandardKey, target.tag).toFormat('key')
                return reference.schema[0]
            }
            
            // Pass the current component's StandardKey to children
            const contextKey = targetStandardKey
            const payload = target._payload.nestedSchema
                ? target._payload.nestedSchema(lookup, { ...options, key: contextKey, parent: contextKey, mappings: target._mapping })
                : target._payload.schema(target.key, target.universalKey, target._mapping)
            if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
            }
            // Add Key tag to children if _key exists AND is NOT Simple (for Remove/Replace edit semantics)
            // Add Parent tag to children if explicitParent is defined (after Key tag)
            let children = [...payload.children]
            if (target._key) {
                const keyJSON = target._key.toJSON()
                // If toJSON returns a string, it's Simple (don't add Key tag to children)
                // If toJSON returns an object, it's Remove/Replace (add Key tag to children)
                if (keyJSON && typeof keyJSON !== 'string' && target._key.schema.length > 0) {
                    children = [target._key.schema[0], ...children]
                }
            }
            if (target.explicitParent && target.explicitParent.schema.length > 0) {
                children = [target.explicitParent.schema[0], ...children]
            }
            return { ...payload, data: { ...payload.data, from: target._from, origin: target._origin }, children }
        }

        referencedKeys(): StandardComponentReferenceKey[] {
            return this._payload.referencedKeys(this._mapping ?? [])
        }

        //
        // The equals method should often be overridden at the specific component level,
        // if there is simplified processing, or if the component includes references that
        // can be equal (semantically) without being identical.
        // Intentional fallback: keep wrapper-level deep equality here rather than applying
        // defaultedEquals globally. Per-type overrides decide where optional semantic fields
        // should collapse undefined and semantic-empty.
        //
        equals(incoming: StandardComponent): boolean {
            return deepEqual(this.toJSON(), incoming.toJSON())
        }

        //
        // The merge method at this level does *not* cope with edit-tags like Replace and Remove.
        // That functionality is handled at the StandardForm level: Merge at the Component level
        // is strictly for merging the content of two non-edit Components. It will, however, merge
        // edit tags on the import and export information of the components
        //
        merge(incoming: StandardComponent): StandardComponent {
            // Create returnValue from this component (clone)
            const returnValue = new GeneratedComponentClass(this)
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new MergeConflictError(`Merge of two unequal universalKeys in ${label}`)
            }
            if (this.key && incoming.key && this.key !== incoming.key) {
                throw new MergeConflictError(`Merge of two unequal keys in ${label}`)
            }
            if (this._from && incoming._from && this._from !== incoming._from) {
                throw new MergeConflictError(`Merge of two unequal 'from' values in ${label}`)
            }
            // Merge universalKey - use getter for incoming, direct property for setting returnValue
            returnValue._universalKey = this._universalKey ?? incoming.universalKey
            // Merge _key (StandardExplicitKey)
            if (this._key && (incoming as any)._key) {
                const merged = this._key.merge((incoming as any)._key)
                returnValue._key = merged ?? undefined
            } else {
                returnValue._key = this._key ?? (incoming as any)._key
            }
            returnValue._from = this._from ?? incoming._from
            returnValue._origin = this._origin ?? (incoming as any)._origin
            returnValue._payload = this._payload.merge((incoming as any)._payload)
            // Merge explicitParent
            if (this.explicitParent && (incoming as any).explicitParent) {
                const merged = this.explicitParent.merge((incoming as any).explicitParent)
                returnValue.explicitParent = merged ?? undefined
            } else {
                returnValue.explicitParent = this.explicitParent ?? (incoming as any).explicitParent
            }

            return this._wrap(returnValue)
        }

        /**
         * Internal method to apply explicitParent diff logic to a component.
         * Can be called from overridden diff methods to handle explicitParent consistently.
         * 
         * @param base - The component to apply the diff to
         * @param incoming - The incoming component being compared against
         * @param explicitParentDiff - Optional pre-computed explicitParent diff to avoid recalculation
         */
        _applyExplicitParentDiffToComponent(
            base: StandardComponent,
            incoming: StandardComponent,
            explicitParentDiff?: StandardExplicitParent | undefined
        ): void {
            const hasExplicitParentDiff = explicitParentDiff !== undefined
            
            if (hasExplicitParentDiff) {
                base.explicitParent = explicitParentDiff
            } else if (this.explicitParent && !incoming.explicitParent) {
                // This has explicitParent, incoming doesn't - include removal in diff
                const removal = this.explicitParent.diff(undefined)
                base.explicitParent = removal ?? this.explicitParent
            } else if (!this.explicitParent && incoming.explicitParent) {
                // Incoming has explicitParent, this doesn't - include it in diff
                base.explicitParent = incoming.explicitParent
            }
        }

        /**
         * Internal method to apply _key diff logic to a component.
         * Can be called from overridden diff methods to handle _key consistently.
         * 
         * @param base - The component to apply the diff to
         * @param incoming - The incoming component being compared against
         * @param keyDiff - Optional pre-computed _key diff to avoid recalculation
         */
        _applyKeyDiffToComponent(
            base: GeneratedComponentClass,
            incoming: StandardComponent,
            keyDiff?: StandardExplicitKey | undefined
        ): void {
            const hasKeyDiff = keyDiff !== undefined
            
            if (hasKeyDiff) {
                // A computed diff exists (e.g., Simple vs Remove creates a Replace operation)
                base._key = keyDiff
            } else {
                // No computed diff - check if keys are semantically equivalent
                const thisKeyJSON = this._key?.toJSON()
                const incomingKeyJSON = (incoming as any)._key?.toJSON()
                
                // If both are simple strings (idempotent) and identical, preserve the key
                if (thisKeyJSON && typeof thisKeyJSON === 'string' && 
                    incomingKeyJSON && typeof incomingKeyJSON === 'string' &&
                    thisKeyJSON === incomingKeyJSON) {
                    // Idempotent: preserve the key (both components have the same simple key)
                    base._key = this._key
                } else if (this._key && !(incoming as any)._key) {
                    // This has _key, incoming doesn't - include removal in diff
                    const removal = this._key.diff(undefined)
                    base._key = removal ?? this._key
                } else if (!this._key && (incoming as any)._key) {
                    // Incoming has _key, this doesn't - include it in diff
                    base._key = (incoming as any)._key
                }
                // If both are undefined, leave base._key as cloned (which will be undefined)
                // Note: If keyDiff was undefined but keys exist and differ semantically,
                // the diff() method on StandardExplicitKey would have returned a diff.
                // So if keyDiff is undefined and both keys exist, they must be semantically equivalent.
            }
        }

        diff(incoming: StandardComponent): StandardComponent | undefined {
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new Error(`Mismatched universalKeys in StandardComponent diff (${this.key} vs ${incoming.key})`)
            }
            // Keys must match for diff to be meaningful, UNLESS universalKeys match (rename case)
            // Defensive check: Components should already be matched by universalKey by StandardForm.diff()
            // This check should never fail in normal operation, but protects against bugs or direct calls
            if (this.key && incoming.key && this.key !== incoming.key) {
                // Allow diff if universalKeys match (this is a rename, not a mismatch)
                if (!(this.universalKey && incoming.universalKey && this.universalKey === incoming.universalKey)) {
                    throw new Error(`Mismatched keys in StandardComponent diff (${this.key} vs ${incoming.key})`)
                }
            }
            // Check _key differences separately - handle undefined cases properly
            // If this._key is undefined and incoming._key is defined, StandardExplicitKey.diff returns incoming
            // But we can't call diff on undefined, so handle this case explicitly
            let keyDiff: StandardExplicitKey | undefined
            if (this._key) {
                keyDiff = this._key.diff((incoming as any)._key)
            } else if ((incoming as any)._key) {
                // this._key is undefined, incoming._key is defined - return incoming as the diff
                keyDiff = (incoming as any)._key
            } else {
                // Both are undefined
                keyDiff = undefined
            }
            const hasKeyDiff = keyDiff !== undefined
            // Check explicitParent differences separately
            const explicitParentDiff = this.explicitParent?.diff((incoming as any).explicitParent)
            const hasExplicitParentDiff = explicitParentDiff !== undefined
            // Check other differences (key and explicitParent are now included in toJSON, but we handle them separately for diff logic)
            const thisJSON = this.toJSON() as any
            const incomingJSON = incoming.toJSON() as any
            const { key: _key1, explicitParent: _explicitParent1, ...thisJSONWithoutKeyAndParent } = thisJSON
            const { key: _key2, explicitParent: _explicitParent2, ...incomingJSONWithoutKeyAndParent } = incomingJSON
            const otherDiff = deepEqual(thisJSONWithoutKeyAndParent, incomingJSONWithoutKeyAndParent)
            // If both are equal and no key or explicitParent diff, return undefined
            if (otherDiff && !hasKeyDiff && !hasExplicitParentDiff) {
                return undefined
            }
            // Otherwise create a diff using edit algebra: diff(a, b) = a.invert().merge(b)
            // Note: merge is non-commutative, so the order matters. We merge the inverted base into the incoming.
            // Create a new plain component with diffed payload
            const base = this.clone() as GeneratedComponentClass
            // Use merge/invert approach if invert() is available, otherwise fall back to incoming component
            if (typeof (this as any).invert === 'function') {
                const inverted = this.invert()
                // Clear keys before merge to avoid double-processing (we handle keys separately via _applyKeyDiffToComponent)
                // Create temporary components without keys for the merge operation
                const invertedWithoutKey = inverted.clone() as GeneratedComponentClass
                invertedWithoutKey._key = undefined
                const incomingWithoutKey = incoming.clone() as GeneratedComponentClass
                incomingWithoutKey._key = undefined
                const merged = invertedWithoutKey.merge(incomingWithoutKey)
                if (merged) {
                    base._payload = (merged as any)._payload
                } else {
                    // Merge returned undefined, meaning a.invert().merge(b) = undefined
                    // Mathematically, this means there are no differences in the payload
                    // Check if we have key or explicitParent differences - if not, return undefined
                    if (!hasKeyDiff && !hasExplicitParentDiff) {
                        // No differences at all (payload merge returned undefined, no key/parent diff)
                        return undefined
                    }
                    // We have key or explicitParent differences but no payload differences
                    // Create an empty payload instance (empty diff means no payload changes)
                    // The key/parent diffs will be applied separately below
                    base._payload = new Base() as InstanceType<typeof Base>
                }
            } else {
                // Component type doesn't support invert() - cannot compute proper diff
                // If there are no differences detected, return undefined
                // Otherwise, this is an error condition - we can't compute the diff properly
                if (otherDiff && !hasKeyDiff && !hasExplicitParentDiff) {
                    return undefined
                }
                // Cannot compute diff for component type without invert() - this should not happen
                // in normal operation, but if it does, we return undefined rather than incorrect diff
                console.warn(`Cannot compute diff for component type without invert() method: ${this.tag}`)
                return undefined
            }
            // Apply _key diff if it exists (pass pre-computed diff to avoid recalculation)
            this._applyKeyDiffToComponent(base, incoming, keyDiff)
            // Apply explicitParent diff if it exists (pass pre-computed diff to avoid recalculation)
            this._applyExplicitParentDiffToComponent(base, incoming, explicitParentDiff)
            return this._wrap(base)
        }

        subset(options: StandardFormSubsetRequest): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._key = this._key ? new StandardExplicitKey(this._key) : undefined
            returnValue._universalKey = this._universalKey
            returnValue._payload = this._payload.subset(options)
            return this._wrap(returnValue)
        }

        withKey(key: string): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key = new StandardExplicitKey(key)
            return this._wrap(returnValue)
        }

        withUniversalKey(key: ComponentUUID | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._universalKey = key
            return this._wrap(returnValue)
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // returnValue._key._fileName = key
            return this._wrap(returnValue)
        }

        withChild(child: StandardReference): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            if (returnValue._payload.withChild) {
                returnValue._payload = returnValue._payload.withChild(child)
            }
            return this._wrap(returnValue)
        }

        withImport(fromAsset: AssetUUID): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._from = fromAsset
            return returnValue
        }

        withOrigin(origin: AssetUUID[] | undefined): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._origin = origin
            return this._wrap(returnValue)
        }

        withExplicitParent(explicitParent: StandardExplicitParent | undefined): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue.explicitParent = explicitParent ? new StandardExplicitParent(explicitParent) : undefined
            return this._wrap(returnValue)
        }

        invert(): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // Invert payload if it has an invert method
            if (this._payload.invert) {
                returnValue._payload = this._payload.invert() as InstanceType<typeof Base>
            }
            // Don't invert simple keys - they're idempotent (applying them multiple times has no effect)
            // Only invert if it's an explicit Remove/Replace operation
            if (this._key) {
                const keyJSON = this._key.toJSON()
                if (keyJSON && typeof keyJSON === 'string') {
                    // Simple key - preserve it (idempotent)
                    returnValue._key = this._key
                } else {
                    // Remove/Replace - invert it
                    returnValue._key = this._key.invert()
                }
            }
            // Invert explicitParent if it exists
            if (this.explicitParent) {
                returnValue.explicitParent = this.explicitParent.invert()
            }
            return this._wrap(returnValue)
        }

        assureReferences(children: StandardReference[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // Delegate to payload if it has assureReferences method
            if (this._payload.assureReferences && typeof this._payload.assureReferences === 'function') {
                const result = this._payload.assureReferences(children)
                returnValue._payload = result.payload as InstanceType<typeof Base>
                // inlineRemainder discarded at component level; nestedSchema uses payload directly
            }
            // If payload doesn't have assureReferences, return instance unchanged
            return this._wrap(returnValue)
        }

        removeReferences(references: StandardReference[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // Delegate to payload if it has removeReferences method
            if (this._payload.removeReferences && typeof this._payload.removeReferences === 'function') {
                returnValue._payload = this._payload.removeReferences(references) as InstanceType<typeof Base>
            }
            // If payload doesn't have removeReferences, return instance unchanged
            return this._wrap(returnValue)
        }

        isEmpty(): boolean {
            // Check if payload has isEmpty method, otherwise return false
            if (this._payload.isEmpty && typeof this._payload.isEmpty === 'function') {
                return this._payload.isEmpty()
            }
            return false
        }
    }
}

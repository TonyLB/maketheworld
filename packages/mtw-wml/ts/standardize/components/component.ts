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
import { StandardReplace } from "./edits";
import { StandardComponentData, StandardFormSubsetRequest } from "../baseClasses";
import { ReferenceFormat } from "./utils/references";
import { isStandardReferencePayloadData, StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { StandardKey } from "./reference";
import { StandardExplicitParent } from "../explicit";
import SchemaTagTree from "../../tagTree/schema";

export type ComponentConstructorMethodsDiff<D extends ComponentKey> = {
    action: 'Replace';
} | {
    action: 'Edit';
    payload: D;
}

export interface ComponentConstructorMethods<D> {
    fromJSON(line: D): void;
    fromSchema(node: GenericTreeNode<SchemaTag>): void;
    subset(options: StandardFormSubsetRequest): this;
    merge(incoming: this): this;
    toJSON(options?: StandardToJSONOptions): Omit<D, 'key' | 'universalKey'>;
    schema(key?: string, universalKey?: ComponentUUID): GenericTreeNode<SchemaTag>;
    nestedSchema?(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag>;
    tag: ComponentTag;
    referencedKeys(mapping: StandardKey[]): StandardComponentReferenceKey[];
    remapReferences?: (props: { mappings: StandardKey[], mapTo: ReferenceFormat }) => this;
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): this;
    withChild?(child: StandardReference): this;
}

export const componentClassFactory = <D extends StandardComponentData, TBase extends new (...args: any[]) => ComponentConstructorMethods<D>>(Base: TBase, label: string) => {
    return class GeneratedComponentClass implements StandardComponent {
        _key: StandardKey;
        _mapping?: StandardKey[];
        _payload: InstanceType<typeof Base>;
        _from?: AssetUUID;
        _origin?: AssetUUID[];
        explicitParent?: StandardExplicitParent;
        _implicitParent?: StandardKey;
        constructor(props: string | D | GenericTreeNode<SchemaTag> | GeneratedComponentClass) {
            this._payload = new Base() as InstanceType<typeof Base>
            if (props instanceof GeneratedComponentClass) {
                this._key = new StandardKey(props._key)
                this._payload = props._payload
                this._from = props._from
                this._origin = props._origin
                this._mapping = props._mapping
                // Clone explicitParent if it exists - use schema to clone (handles empty Parent tags)
                this.explicitParent = props.explicitParent ? new StandardExplicitParent(props.explicitParent.schema) : undefined
                this._implicitParent = props._implicitParent ? new StandardKey(props._implicitParent) : undefined
                return
            }
            if (typeof props === 'string' && isLegalKey(props)) {
                this._key = new StandardKey({
                    tag: this._payload.tag,
                    key: props
                })
                return
            }
            if (typeof props === 'string' && isSchemaComponentUUID(props)) {
                this._key = new StandardKey(props)
                return
            }
            if (isSchemaTreeNode(props) || typeof props === 'string') {
                const node = typeof props === 'string'
                    ? nodeFromWML(props)
                    : props
                if (!treeNodeTypeguard(isSchemaComponent)(node)) {
                    throw new Error(`Invalid schema node type in ${label} constructor call: ${node.data.tag}`)
                }
                const tag = node.data.tag
                this._key = new StandardKey({ tag, key: node.data.key, universalKey: 'uuid' in node.data ? node.data.uuid : undefined })
                this._from = node.data.from
                this._origin = 'origin' in node.data ? node.data.origin : undefined
                // Extract Parent tag from children using tagTree (handles Remove/Replace wrapping)
                // Filter for Parent tags that are direct children, excluding ones nested in other components
                const tagTree = new SchemaTagTree(node.children)
                const parentItem = tagTree
                    .filter({ 
                        and: [
                            { match: 'Parent' },
                            { not: { or: [
                                { match: 'Room' },
                                { match: 'Feature' },
                                { match: 'Knowledge' },
                                { match: 'Example' },
                                { match: 'Character' },
                                { match: 'Image' },
                                { match: 'Map' },
                                { match: 'Message' },
                                { match: 'Moment' },
                                { match: 'Exit' }
                            ] } }
                        ]
                    })
                    .prune({ not: { or: [{ match: 'Parent' }, { match: 'String' }, { match: 'Remove' }, { match: 'Replace' }, { match: 'ReplaceMatch' }, { match: 'ReplacePayload' }] } })
                    .tree
                if (parentItem.length > 0) {
                    // Always create StandardExplicitParent if Parent tag exists (even if empty)
                    this.explicitParent = new StandardExplicitParent(parentItem)
                }
                // Create a node without Parent tag for payload processing
                const nodeWithoutParent = {
                    ...node,
                    children: node.children.filter(child => {
                        // Filter out Parent tags (but keep them if wrapped in Remove/Replace for payload processing)
                        const childTagTree = new SchemaTagTree([child])
                        const hasParent = childTagTree.filter({ match: 'Parent' }).tree.length > 0
                        return !hasParent
                    })
                }
                this._payload.fromSchema(nodeWithoutParent)
                return
            }
            this._key = isStandardReferencePayloadData(props) ? new StandardKey(props) : typeof props === 'string' ? new StandardKey(props) : new StandardKey('')
            this._payload.fromJSON(props)
            if (!isSchemaTreeNode(props) && props.implicitParent) {
                this._implicitParent = new StandardKey(props.implicitParent)
            }
        }

        withMapping(mapping: StandardKey[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._mapping = mapping
            return returnValue as StandardComponent
        }
        get key(): string | undefined { return this._key.key }
        get universalKey(): ComponentUUID | undefined { return this._key.universalKey }
        get standardKey(): StandardKey { return this._key }
        withStandardKey(key: StandardKey): this {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key = key
            return returnValue as this
        }
        get fileName(): string | undefined { return undefined }
        get tag(): ComponentTag { return this._payload.tag }
        get referenceData(): StandardReferenceData {
            if (this.universalKey && !this.key) {
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
        get implicitParent(): StandardKey | undefined { return this._implicitParent }

        clone(): StandardComponent {
            return new GeneratedComponentClass(this)
        }

        mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._payload = returnValue._payload.mapContents(callback)
            return returnValue
        }

        remapReferences(mapTo): this {
            if (this._payload.remapReferences) {
                const returnValue = this.clone() as GeneratedComponentClass
                returnValue._payload = returnValue._payload.remapReferences?.({ mapTo, mappings: this._mapping ?? [] }) ?? returnValue._payload
                returnValue._implicitParent = this._implicitParent ? this._implicitParent.toFormat(mapTo) : undefined
                return returnValue as this
            }
            return this
        }

        toJSON(options?: StandardToJSONOptions): D {
            return {
                key: this.key,
                universalKey: this.universalKey,
                ...this._payload.toJSON(options),
                ...(this._from ? { from: this._from } : {}),
                ...(this._origin ? { origin: this._origin } : {}),
                ...(this.explicitParent ? { explicitParent: this.explicitParent.toJSON() } : {}),
                ...(this._implicitParent ? { implicitParent: this._implicitParent.toJSON() } : {}),
            } as D
        }

        get schema(): GenericTreeNode<SchemaTag> {
            const payload = this._payload.schema(this.key, this.universalKey)
            if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
            }
            // Add Parent tag to children if explicitParent is defined
            const children = [...payload.children]
            if (this.explicitParent) {
                const parentSchema = this.explicitParent.schema
                if (parentSchema.length > 0) {
                    children.push(parentSchema[0])
                }
            }
            return { ...payload, data: { ...payload.data, from: this._from, origin: this._origin }, children }
        }

        nestedSchema(lookup: (value: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
            // Check if component should be rendered based on implicitParent
            // Component should be rendered if:
            //   (a) It has no implicitParent and we are rendering the asset (expectedParent === undefined), OR
            //   (b) It has an implicitParent and we're rendering in the context of that parent (implicitParent matches expectedParent)
            const expectedParent = options.parent
            
            // Get implicit parent as StandardKey (works both before and after finalize)
            const implicitParentKey: StandardKey | undefined = this._implicitParent
            
            // Determine if we should render:
            // - If expectedParent is undefined, render only if component is Asset-level (no implicit parent)
            // - If expectedParent is set, render only if it matches our implicit parent (compare StandardKeys)
            const shouldRender = typeof expectedParent === 'undefined'
                ? typeof implicitParentKey === 'undefined'  // Asset-level rendering: only render if component is also Asset-level
                : implicitParentKey?.equals(expectedParent)  // Nested rendering: only render if parent matches
            
            if (!shouldRender) {
                const reference = new StandardReference(this._key).toFormat('key')
                return reference.schema[0]
            }
            
            // Pass the current component's StandardKey to children
            // Children should render if their implicitParent matches this component's StandardKey
            const contextKey = this._key.plain
            const payload = this._payload.nestedSchema
                ? this._payload.nestedSchema(lookup, { ...options, key: contextKey, parent: contextKey })
                : this._payload.schema(this.key, this.universalKey)
            if (!treeNodeTypeguard(isSchemaComponent)(payload)) {
                throw new Error(`Invalid schema payload in ${label} schema: ${JSON.stringify(payload)}`)
            }
            // Add Parent tag to children if explicitParent is defined
            const children = [...payload.children]
            if (this.explicitParent) {
                const parentSchema = this.explicitParent.schema
                if (parentSchema.length > 0) {
                    children.push(parentSchema[0])
                }
            }
            return { ...payload, data: { ...payload.data, from: this._from, origin: this._origin }, children }
        }

        referencedKeys(): StandardComponentReferenceKey[] {
            return this._payload.referencedKeys(this._mapping ?? [])
        }

        //
        // The equals method should often be overridden at the specific component level,
        // if there is simplified processing, or if the component includes references that
        // can be equal (semantically) without being identical.
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
        // TODO: Revisit merge() logic after context removal - should use buildComponentGraph to determine
        // proper parent relationships when components appear in multiple contexts. The current context
        // intersection in StandardKey.merge() is a temporary measure that will be removed.
        //
        merge(incoming: StandardComponent): StandardComponent {
            const returnValue = new GeneratedComponentClass(this.universalKey ?? this.key ??'')
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new MergeConflictError(`Merge of two unequal universalKeys in ${label}`)
            }
            if (this.key && incoming.key && this.key !== incoming.key) {
                throw new MergeConflictError(`Merge of two unequal keys in ${label}`)
            }
            if (this._from && incoming._from && this._from !== incoming._from) {
                throw new MergeConflictError(`Merge of two unequal 'from' values in ${label}`)
            }
            returnValue._key = this._key.merge(incoming._key)
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
            // implicitParent is computed metadata - don't copy during merge, will be recomputed during finalize()
            returnValue._implicitParent = undefined

            return returnValue as StandardComponent
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

        diff(incoming: StandardComponent): StandardComponent | undefined {
            if (this.universalKey && incoming.universalKey && this.universalKey !== incoming.universalKey) {
                throw new Error(`Mismatched universalKeys in StandardComponent diff (${this.key} vs ${incoming.key})`)
            }
            // Check explicitParent differences separately
            const explicitParentDiff = this.explicitParent?.diff((incoming as any).explicitParent)
            const hasExplicitParentDiff = explicitParentDiff !== undefined
            // Check other differences (explicitParent is now included in toJSON, but we handle it separately for diff logic)
            // Temporarily exclude explicitParent and implicitParent from comparison to check other differences
            // implicitParent is computed metadata and should not be included in diff comparisons
            const thisJSON = this.toJSON() as any
            const incomingJSON = incoming.toJSON() as any
            const { explicitParent: _explicitParent1, implicitParent: _implicitParent1, ...thisJSONWithoutParent } = thisJSON
            const { explicitParent: _explicitParent2, implicitParent: _implicitParent2, ...incomingJSONWithoutParent } = incomingJSON
            const otherDiff = deepEqual(thisJSONWithoutParent, incomingJSONWithoutParent)
            // If both are equal and no explicitParent diff, return undefined
            if (otherDiff && !hasExplicitParentDiff) {
                return undefined
            }
            // Otherwise create a diff
            // TODO: Revisit diff() logic after context removal - should use buildComponentGraph to determine
            // cascade-delete behavior based on whether components appear with other parents that still have connections.
            // For now, create StandardReplace without setting context (context will be removed entirely).
            const diffComponent = new StandardReplace(this, incoming)
            // Apply explicitParent diff to the diff component (pass pre-computed diff to avoid recalculation)
            if (diffComponent) {
                this._applyExplicitParentDiffToComponent(diffComponent, incoming, explicitParentDiff)
            }
            return diffComponent
        }

        subset(options: StandardFormSubsetRequest): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._key = this._key
            returnValue._payload = this._payload.subset(options)
            return returnValue
        }

        withKey(key: string): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key.key = key
            return returnValue
        }

        withUniversalKey(key: ComponentUUID | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            returnValue._key.universalKey = key
            return returnValue
        }

        withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            const newContext = leastCommonContext.map((context) => (context.clone()))
            returnValue._key.context = newContext.length > 0 ? newContext : undefined
            return returnValue
        }

        withFileName(key: string | undefined): StandardComponent {
            const returnValue = new GeneratedComponentClass(this)
            // returnValue._key._fileName = key
            return returnValue
        }

        withChild(child: StandardReference): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            if (returnValue._payload.withChild) {
                returnValue._payload = returnValue._payload.withChild(child)
            }
            return returnValue
        }

        withImport(fromAsset: AssetUUID): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._from = fromAsset
            return returnValue
        }

        withOrigin(origin: AssetUUID[] | undefined): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._origin = origin
            return returnValue
        }

        withImplicitParent(implicitParent: StandardKey | undefined): StandardComponent {
            const returnValue = this.clone() as GeneratedComponentClass
            returnValue._implicitParent = implicitParent ? new StandardKey(implicitParent) : undefined
            return returnValue
        }
    }
}

import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { StandardComponentData, StandardFormSubsetRequest } from "../baseClasses";
import { ReferenceFormat } from "./utils/references";
import { StandardReferenceData } from "./dataTypes/reference";
import StandardReference from "../keys/reference";
import { StandardKey } from "../keys/key";
import { StandardExplicitParent, StandardExplicitKey } from "../explicit";
import { OrganizationContext } from "../schemaOrganization";
import { StandardLiteral } from "../literal";
export type StandardToJSONOptions = {
    stripUniversalKey?: boolean;
    /** @deprecated Legacy schema-tree hook (no-op). */
    stripUIFields?: boolean;
}

export type StandardComponentReferenceKey = {
    reference: StandardReference;
    referenceType: 'Link' | 'Position' | 'Exit' | 'Edge' | 'Direct' | 'Dependency' | 'Facet';
}

export type NestedSchemaOptions = {
    key: StandardKey;
    parent?: StandardKey;  // Parent component StandardKey (undefined for Asset-level rendering)
    removeContext?: boolean;  // If true, nestedSchema will invert its contents for display in a remove context
    organization?: OrganizationContext;  // Optional organization context for parentage queries
    mappings?: StandardReference[];  // Optional mappings for remapping references (e.g., for Links in StandardRender)
}

export type StandardDiffOptions = {
}

export interface StandardComponent {
    _key?: StandardExplicitKey;
    _from?: AssetUUID;
    key?: string;
    universalKey?: ComponentUUID;
    standardKey: StandardKey;
    explicitParent?: StandardExplicitParent;
    shortName?: StandardLiteral;
    clone(): StandardComponent;
    withMapping(mapping: StandardReference[]): StandardComponent;
    withKey(key: string): StandardComponent;
    withUniversalKey(key: string | undefined): StandardComponent;
    fileName?: string;
    origin?: AssetUUID[];
    withFileName(key: string | undefined): StandardComponent;
    tag: ComponentTag | 'Remove' | 'Replace';
    toJSON(options?: StandardToJSONOptions): StandardComponentData;
    schema: GenericTreeNode<SchemaTag>;
    nestedSchema(lookup: (key: string | StandardKey) => StandardComponent | undefined, options: Partial<NestedSchemaOptions>): GenericTreeNode<SchemaTag>;
    equals(incoming: StandardComponent): boolean;
    merge(incoming: StandardComponent): StandardComponent | undefined;
    diff(incoming: StandardComponent, options?: StandardDiffOptions): StandardComponent | undefined;
    subset(options: StandardFormSubsetRequest): StandardComponent;
    referencedKeys(): StandardComponentReferenceKey[];
    remapReferences(mapTo: ReferenceFormat): StandardComponent;
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent;
    reference: StandardReference;
    referenceData: StandardReferenceData;
    withChild(child: StandardReference): StandardComponent;
    withImport(fromAsset: AssetUUID): StandardComponent;
    withOrigin(origin: AssetUUID[] | undefined): StandardComponent;
    withShortName(shortName: StandardLiteral | undefined): StandardComponent;
    invert?(): StandardComponent;
    /**
     * Assures that the given child references exist in the appropriate buckets with ref={0} if needed.
     * Delegates to payload's assureReferences if available; payload returns { payload, inlineRemainder }.
     * Component returns updated instance; inlineRemainder is discarded (nestedSchema uses payload directly).
     * See AGENT.implementation.md for detailed documentation.
     */
    assureReferences(children: StandardReference[]): StandardComponent;
    /**
     * Removes matching references from the component's reference lists.
     * Delegates to payload's removeReferences if available, otherwise returns instance unchanged.
     */
    removeReferences(references: StandardReference[]): StandardComponent;
    isEmpty(): boolean;
}

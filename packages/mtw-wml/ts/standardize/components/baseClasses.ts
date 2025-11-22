import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { AssetUUID, ComponentUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { ComponentTag } from "./dataTypes/abstract";
import { StandardComponentData, StandardFormSubsetRequest } from "../baseClasses";
import { ReferenceFormat } from "./utils/references";
import { StandardReferenceData } from "./dataTypes/reference";
import StandardReference, { StandardKey } from "./reference";
import { StandardExplicitParent } from "../explicit";

export type StandardToJSONOptions = {
    stripUniversalKey?: boolean;
    stripUIFields?: boolean;
}

export type StandardComponentReferenceKey = {
    key: StandardKey;
    referenceType: 'Link' | 'Position' | 'Exit' | 'Direct' | 'Dependency';
}

export type NestedSchemaOptions = {
    key: StandardKey;
    context: StandardKey[];
    removeContext?: boolean;
    inLeastCommonContext?: boolean;
}

export type StandardDiffOptions = {
}

export interface StandardComponent {
    _key: StandardKey;
    _from?: AssetUUID;
    key?: string;
    universalKey?: ComponentUUID;
    explicitParent?: StandardExplicitParent;
    implicitParent?: ComponentUUID;
    topLevel?: boolean;
    clone(): StandardComponent;
    withMapping(mapping: StandardKey[]): StandardComponent;
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
    withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent;
    withChild(child: StandardReference): StandardComponent;
    withImport(fromAsset: AssetUUID): StandardComponent;
    withOrigin(origin: AssetUUID[] | undefined): StandardComponent;
    withImplicitParent(implicitParent: ComponentUUID | undefined): StandardComponent;
    withTopLevel(topLevel: boolean | undefined): StandardComponent;
}

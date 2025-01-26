import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "../../schema/baseClasses";
import { StandardComponentData } from "./dataTypes";
import { ComponentTag } from "./dataTypes/abstract";
import { StandardExportItem, StandardImportItem } from "./metaData";
import { StandardComponentExport, StandardComponentImport } from "./dataTypes/metaData";
import { SerializeNDJSONMixin } from "../baseClasses";

export type StandardToJSONOptions = {
    stripUniversalKey?: boolean;
    stripUIFields?: boolean;
}

export type StandardComponentReferenceKey = {
    key: string;
    referenceType: 'Link' | 'Position' | 'Exit' | 'Direct' | 'Dependency';
    global?: boolean;
}

export type NestedSchemaOptions = {
    localKey: string;
    globalKey: string;
    removeContext?: boolean;
}

export interface StandardComponent {
    key: string;
    clone(): StandardComponent;
    universalKey?: string;
    global?: boolean;
    withKey(key: string): StandardComponent;
    withUniversalKey(key: string | undefined): StandardComponent;
    fileName?: string;
    withFileName(key: string | undefined): StandardComponent;
    import?: StandardImportItem;
    withImport(importData: StandardImportItem | StandardComponentImport | undefined): StandardComponent;
    export?: StandardExportItem;
    withExport(exportData: StandardExportItem | StandardComponentExport | string | undefined): StandardComponent;
    tag: ComponentTag | 'Remove' | 'Replace';
    toJSON(options?: StandardToJSONOptions): StandardComponentData & SerializeNDJSONMixin;
    toNDJSON(options?: StandardToJSONOptions): StandardComponentData & SerializeNDJSONMixin;
    schema: GenericTreeNode<SchemaTag>;
    nestedSchema(byId: Record<string, StandardComponent>, options: Partial<NestedSchemaOptions>): GenericTreeNode<SchemaTag>;
    merge(incoming: StandardComponent): StandardComponent | undefined;
    diff(incoming: StandardComponent): StandardComponent | undefined;
    referencedKeys(): StandardComponentReferenceKey[];
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent;
}

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
}

//
// Because StandardReplace cannot be defined until *after* all the nonEdit components
// are defined (since it calls nonEditComponentFactory as part of its constructor),
// we have to define the return type of the diff method for StandardComponent in a way
// that avoids circular definition: This diff method can either say "Replace the components",
// or can deliver a payload of the same sort of StandarComponent, with replace and updates
// inside the individual data items. This is a bit of a hack, but it works, pending a future
// iteration to some 
//
export type StandardComponentDiffReturn = {
    action: 'Replace';
} | {
    action: 'Edit';
    payload: StandardComponent;
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
    nestedSchema(byId: Record<string, StandardComponent>, localKey?: string, globalKey?: string): GenericTreeNode<SchemaTag>;
    merge(incoming: StandardComponent): StandardComponent | undefined;
    diff(incoming: StandardComponent): StandardComponentDiffReturn | undefined;
    referencedKeys(): StandardComponentReferenceKey[];
    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardComponent;
}

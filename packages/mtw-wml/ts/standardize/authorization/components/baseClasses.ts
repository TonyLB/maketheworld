import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { NestedSchemaOptions, StandardDiffOptions, StandardToJSONOptions } from "../../components/baseClasses";
import { StandardAuthorizationData } from "./dataTypes";

export interface StandardAuthorizationItem {
    clone(): StandardAuthorizationItem;
    tag: 'Grant' | 'Remove' | 'Replace';
    toJSON(options?: StandardToJSONOptions): StandardAuthorizationData;
    schema: GenericTreeNode<SchemaTag>;
    nestedSchema(byId: Record<string, StandardAuthorizationItem>, options: Partial<NestedSchemaOptions>): GenericTreeNode<SchemaTag>;
    merge(incoming: StandardAuthorizationItem): StandardAuthorizationItem | undefined;
    diff(incoming: StandardAuthorizationItem, options?: StandardDiffOptions): StandardAuthorizationItem | undefined;
}

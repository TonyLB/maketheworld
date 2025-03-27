import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, SerializeNDJSONMixin } from "../baseClasses";
import { isLegalKey, nodeFromWML } from "../utils";
import { StandardToJSONOptions } from "./baseClasses";
import { StandardBaseData } from "./dataTypes/abstract"
import { isSchemaTreeNode } from "./utils";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components";
import { StandardLiteral } from "../literal";

export interface ComponentInterface {
    key: string;
    universalKey?: string;
    schema: GenericTreeNode<SchemaTag>;
    clone(): this;
    toJSON(options?: StandardToJSONOptions): Record<string, any>;
    merge(incoming: this): this | undefined;
    withUniversalKey(key: string): this;
}

export interface HasName {
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
}

export interface HasDescription {
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
}

export interface HasShortName {
    shortName?: StandardLiteral;
}

export interface HasFileAssociation {
    fileAssociation?: string;
    withFileAssociation(fileName: string): this;
}

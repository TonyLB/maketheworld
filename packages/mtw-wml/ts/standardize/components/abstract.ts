import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode } from "../baseClasses";
import { StandardToJSONOptions } from "./baseClasses"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
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

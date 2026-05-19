import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode } from "../baseClasses";
import { StandardToJSONOptions } from "./baseClasses"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { SchemaDescriptionTag, SchemaDisplayNameTag } from "@tonylb/mtw-base/ts/schema/prose";
import { StandardLiteral } from "../literal";
import { StandardReferenceData } from "./dataTypes/reference";
import { StandardKey } from "../keys/key";

export interface ComponentInterface {
    _key: StandardKey
    key?: string;
    universalKey?: string;
    schema: GenericTreeNode<SchemaTag>;
    clone(): this;
    toJSON(options?: StandardToJSONOptions): Record<string, any>;
    merge(incoming: this): this | undefined;
    withUniversalKey(key: string): this;
    referenceData: StandardReferenceData;
}

export interface HasDisplayName {
    displayName?: EditWrappedStandardNode<SchemaDisplayNameTag, SchemaOutputTag>;
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

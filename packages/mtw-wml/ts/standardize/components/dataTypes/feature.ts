import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag } from "../../../schema/baseClasses";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract";

export type StandardFeatureData = {
    tag: 'Feature';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBaseData

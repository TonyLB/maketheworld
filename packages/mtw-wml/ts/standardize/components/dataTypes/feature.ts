import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag } from "../../../schema/baseClasses";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";

export type StandardFeatureData = {
    tag: 'Feature';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
} & StandardBaseData

export const isStandardFeature = (arg: any): arg is StandardFeatureData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Feature'),
        checkTypes(arg, {
            key: 'string'
        },
        {
            name: 'node',
            description: 'node'
        })
    )
}
import { SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { StandardReferenceData } from "./reference";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract";
import { checkAll, checkTypes } from "./typeguards";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";

export type StandardFeatureData = {
    tag: 'Feature';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    examples?: (StandardReferenceData | StandardRemoveData)[];
    global?: boolean;
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
            description: 'node',
            global: 'boolean'
        })
    )
}
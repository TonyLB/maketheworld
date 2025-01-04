import { SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { StandardReferenceData } from ".";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    examples?: StandardReferenceData[];
} & StandardBaseData

export const isStandardKnowledge = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {
            key: 'string'
        },
        {
            name: 'node',
            description: 'node'
        })
    )
}
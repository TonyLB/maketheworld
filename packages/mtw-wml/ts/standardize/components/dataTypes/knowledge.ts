import { SchemaDescriptionTag, SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { StandardReferenceData } from "./reference";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { StandardRemoveData } from ".";

export type StandardKnowledgeData = {
    tag: 'Knowledge';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    examples?: (StandardReferenceData | StandardRemoveData)[];
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
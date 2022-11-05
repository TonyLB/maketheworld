import { SchemaConditionTagAssetContext, SchemaConditionTagDescriptionContext, SchemaConditionTagMapContext, SchemaTaggedMessageIncomingContents } from "./baseClasses";
import { isParseConditionTagDescriptionContext, ParseConditionTag, ParseConditionTagAssetContext, ParseConditionTagMapContext } from "../parser/baseClasses";
import { translateTaggedMessageContents } from "./taggedMessage";

//
// TODO: Refactor SchemaCondition to be as generalizable as ParseCondition
//
export type SchemaConditionTagFromParse<T extends ParseConditionTag> =
    T extends ParseConditionTagAssetContext
        ? SchemaConditionTagAssetContext
        : T extends ParseConditionTagMapContext
            ? SchemaConditionTagMapContext
            : SchemaConditionTagDescriptionContext

export const schemaFromCondition = <T extends ParseConditionTag>(item: T, contents: SchemaConditionTagFromParse<T>["contents"]): SchemaConditionTagFromParse<T> => (
    {
        tag: 'If',
        contextTag: item.contextTag,
        conditions: [{
            if: item.if,
            dependencies: item.dependencies,    
        }],
        contents: (isParseConditionTagDescriptionContext(item))
            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
            : contents,
        parse: item
    } as unknown as SchemaConditionTagFromParse<T>
)

export default schemaFromCondition

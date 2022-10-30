import { SchemaConditionTagAssetContext, SchemaConditionTagDescriptionContext, SchemaTaggedMessageIncomingContents } from "./baseClasses";
import { isParseConditionTagDescriptionContext, ParseConditionTag, ParseConditionTagAssetContext } from "../parser/baseClasses";
import { translateTaggedMessageContents } from "./taggedMessage";

type SchemaConditionTagFromParse<T extends ParseConditionTag> =
    T extends ParseConditionTagAssetContext
        ? SchemaConditionTagAssetContext
        : SchemaConditionTagDescriptionContext

export const schemaFromCondition = <T extends ParseConditionTag>(item: T, contents: SchemaConditionTagFromParse<T>["contents"]): SchemaConditionTagFromParse<T> => (
    {
        tag: 'If',
        contextTag: item.contextTag,
        if: item.if,
        dependencies: item.dependencies.map(({ on }) => (on)),
        contents: (isParseConditionTagDescriptionContext(item)) ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[]) : contents,
        parse: item
    } as SchemaConditionTagFromParse<T>
)

export default schemaFromCondition

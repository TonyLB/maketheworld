import { SchemaConditionTagAssetContext, SchemaConditionTagDescriptionContext } from "./baseClasses";
import { ParseConditionTag, ParseConditionTagAssetContext } from "../parser/baseClasses";

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
        contents,
        parse: item
    } as SchemaConditionTagFromParse<T>
)

export default schemaFromCondition

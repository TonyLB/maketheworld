import { SchemaAssetLegalContents, SchemaConditionTag } from "./baseClasses";
import { ParseConditionTag } from "../parser/baseClasses";

export const schemaFromCondition = (item: ParseConditionTag, contents: SchemaAssetLegalContents[]): SchemaConditionTag => ({
    tag: 'If',
    if: item.if,
    dependencies: item.dependencies.map(({ on }) => (on)),
    contents,
    parse: item
})

export default schemaFromCondition

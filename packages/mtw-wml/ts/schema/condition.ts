import { SchemaAssetLegalContents, SchemaConditionTag } from "../baseClasses";
import { ParseConditionTag } from "../parser/baseClasses";

export const schemaFromCondition = (item: ParseConditionTag, contents: SchemaAssetLegalContents[]): SchemaConditionTag => ({
    tag: 'Condition',
    if: item.if,
    dependencies: item.dependencies.map(({ on }) => (on)),
    contents
})

export default schemaFromCondition

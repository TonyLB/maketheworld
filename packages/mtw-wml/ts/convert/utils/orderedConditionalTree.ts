import { NormalConditionStatement } from "../../normalize/baseClasses"
import { SchemaTag } from "../../schema/baseClasses"

export type OrderedConditionalNode = {
    condition: NormalConditionStatement;
    contents: OrderedConditionalTree;
}

export type OrderedConditionalTree = (SchemaTag | OrderedConditionalNode)[]

export type FlattenedConditionalNode = {
    conditions: NormalConditionStatement[];
    contents: SchemaTag[];
}

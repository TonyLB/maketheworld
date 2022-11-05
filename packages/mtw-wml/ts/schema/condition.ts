import { SchemaConditionMixin, SchemaConditionTagAssetContext, SchemaConditionTagDescriptionContext, SchemaConditionTagMapContext, SchemaTaggedMessageIncomingContents } from "./baseClasses";
import { isParseConditionTagDescriptionContext, ParseConditionTag, ParseConditionTagAssetContext, ParseConditionTagMapContext, ParseElseTag } from "../parser/baseClasses";
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

export const schemaFromElse = <T extends ParseConditionTag>(item: Omit<T, 'tag' | 'if' | 'dependencies'> & { tag: 'Else' }, conditions: SchemaConditionMixin["conditions"], contents: SchemaConditionTagFromParse<T>["contents"]): SchemaConditionTagFromParse<T> => (
    {
        tag: 'If',
        contextTag: item.contextTag,
        conditions,
        contents: (isParseConditionTagDescriptionContext({ ...item, tag: 'If', if: '', dependencies: [] }))
            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
            : contents,
        parse: item
    } as unknown as SchemaConditionTagFromParse<T>
)

export const schemaFromElseIf = <T extends ParseConditionTag>(item: Omit<T, 'tag'> & { tag: 'ElseIf' }, conditions: SchemaConditionMixin["conditions"], contents: SchemaConditionTagFromParse<T>["contents"]): SchemaConditionTagFromParse<T> => (
    {
        tag: 'If',
        contextTag: item.contextTag,
        conditions: [
            ...conditions,
            {
                if: item.if,
                dependencies: item.dependencies
            }
        ],
        contents: (isParseConditionTagDescriptionContext({ ...item, tag: 'If', if: '', dependencies: [] }))
            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
            : contents,
        parse: item
    } as unknown as SchemaConditionTagFromParse<T>
)

export default schemaFromCondition

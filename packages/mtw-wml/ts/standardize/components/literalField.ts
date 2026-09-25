import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardLiteral } from "../literal"
import { StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"

//
// literalFieldFactory produces the shared bundle of helpers (create/toJSON/merge/invert/
// schemaChildren/standardizeConsumer/payload-host typeguard) that every single-string
// literal field on a StandardComponent payload needs, parameterized by the schema tag
// (e.g. 'ShortName', 'Gloss') and the payload's private field name (e.g. '_shortName').
// The standardize-side counterpart to mtw-base's schema-side literalTagFactory.
//
export const literalFieldFactory = <F extends string>(tag: SchemaTag["tag"], fieldName: F) => {
    type LiteralFieldPayloadHost = { [K in F]?: StandardLiteral }

    const isPayloadHost = (payload: unknown): payload is LiteralFieldPayloadHost =>
        typeof payload === 'object' && payload !== null && fieldName in payload

    const createFromJSON = (
        data?: StandardEditableData<string>
    ): StandardLiteral | undefined =>
        data ? new StandardLiteral(data, { tag }) : undefined

    const toJSON = (literal?: StandardLiteral) => literal?.toJSON()

    const merge = (
        left?: StandardLiteral,
        right?: StandardLiteral
    ): StandardLiteral | undefined =>
        (left && right) ? left.merge(right) : left ?? right

    const invert = (literal?: StandardLiteral): StandardLiteral | undefined =>
        literal ? literal.invert() as StandardLiteral : undefined

    const schemaChildren = (literal?: StandardLiteral): GenericTree<SchemaTag> =>
        literal ? literal.nestedSchema() : []

    const standardizeConsumer = <D extends LiteralFieldPayloadHost>(
        context: D
    ): StandardizeConsumerStandardLiteral<D> =>
        new StandardizeConsumerStandardLiteral(context, {
            tag,
            update(literal) {
                (this as LiteralFieldPayloadHost)[fieldName] = literal
            },
        })

    return {
        isPayloadHost,
        createFromJSON,
        toJSON,
        merge,
        invert,
        schemaChildren,
        standardizeConsumer,
    }
}

export type LiteralFieldFactoryOutput<F extends string> = ReturnType<typeof literalFieldFactory<F>>

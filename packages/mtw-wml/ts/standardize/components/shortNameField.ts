import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardLiteral } from "../literal"
import { StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"

export type ShortNamePayloadHost = { _shortName?: StandardLiteral }

export const createShortNameFromJSON = (
    data?: StandardEditableData<string>
): StandardLiteral | undefined =>
    data ? new StandardLiteral(data, { tag: 'ShortName' }) : undefined

export const shortNameToJSON = (literal?: StandardLiteral) => literal?.toJSON()

export const mergeShortName = (
    left?: StandardLiteral,
    right?: StandardLiteral
): StandardLiteral | undefined =>
    (left && right) ? left.merge(right) : left ?? right

export const invertShortName = (literal?: StandardLiteral): StandardLiteral | undefined =>
    literal ? literal.invert() as StandardLiteral : undefined

export const shortNameSchemaChildren = (literal?: StandardLiteral): GenericTree<SchemaTag> =>
    literal ? literal.nestedSchema() : []

export const standardizeShortNameConsumer = <D extends ShortNamePayloadHost>(
    context: D
): StandardizeConsumerStandardLiteral<D> =>
    new StandardizeConsumerStandardLiteral(context, {
        tag: 'ShortName',
        update(literal) {
            this._shortName = literal
        },
    })

import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { StandardLiteral } from "../literal"
import { literalFieldFactory } from "./literalField"
import { StandardizeConsumerStandardLiteral } from "./fromSchemaPipeline"

export type GlossPayloadHost = { _gloss?: StandardLiteral }

const glossFactory = literalFieldFactory('Gloss', '_gloss')

//
// RG-2: Gloss is trimmed, and an empty (or whitespace-only) Gloss is absent rather than
// an error --- unlike ShortName on Object, which throws on empty. Only a plain-text literal
// is trimmed/absent-checked here; a Remove/Replace-wrapped edit is passed through untouched,
// mirroring Object's own ShortName finalize (the final text only exists after merge, so an
// edit node isn't something this layer can resolve or validate).
//
const normalizeGloss = (literal?: StandardLiteral): StandardLiteral | undefined => {
    if (!literal) {
        return undefined
    }
    const json = literal.toJSON()
    if (typeof json !== 'string') {
        return literal
    }
    const trimmed = json.trim()
    if (trimmed.length === 0) {
        return undefined
    }
    if (trimmed === json) {
        return literal
    }
    return new StandardLiteral(trimmed, { tag: 'Gloss' })
}

export const isGlossPayloadHost = glossFactory.isPayloadHost
export const createGlossFromJSON = (data?: StandardEditableData<string>): StandardLiteral | undefined => (
    normalizeGloss(glossFactory.createFromJSON(data))
)
export const glossToJSON = glossFactory.toJSON
export const mergeGloss = glossFactory.merge
export const invertGloss = glossFactory.invert
export const glossSchemaChildren = glossFactory.schemaChildren
export const standardizeGlossConsumer = <D extends GlossPayloadHost>(context: D) => (
    new StandardizeConsumerStandardLiteral(context, {
        tag: 'Gloss',
        update(literal) {
            ;(this as GlossPayloadHost)._gloss = normalizeGloss(literal)
        },
    })
)

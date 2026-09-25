import { StandardLiteral } from "../literal"
import { literalFieldFactory } from "./literalField"

export type ShortNamePayloadHost = { _shortName?: StandardLiteral }

const shortNameFactory = literalFieldFactory('ShortName', '_shortName')

export const isShortNamePayloadHost = shortNameFactory.isPayloadHost
export const createShortNameFromJSON = shortNameFactory.createFromJSON
export const shortNameToJSON = shortNameFactory.toJSON
export const mergeShortName = shortNameFactory.merge
export const invertShortName = shortNameFactory.invert
export const shortNameSchemaChildren = shortNameFactory.schemaChildren
export const standardizeShortNameConsumer = shortNameFactory.standardizeConsumer

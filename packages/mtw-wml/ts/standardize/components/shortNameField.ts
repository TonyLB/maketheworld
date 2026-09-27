import { StandardLiteral } from "../literal"
import { literalFieldFactory } from "./literalField"

export type ShortNamePayloadHost = { _shortName?: StandardLiteral }

//
// The component-level capability: every StandardComponent kind hosts a ShortName, so
// StandardComponent extends this interface.
//
export interface ShortNameHost {
    shortName?: StandardLiteral;
    withShortName(shortName: StandardLiteral | undefined): this;
}

const shortNameFactory = literalFieldFactory('ShortName', '_shortName')

export const createShortNameFromJSON = shortNameFactory.createFromJSON
export const shortNameToJSON = shortNameFactory.toJSON
export const mergeShortName = shortNameFactory.merge
export const invertShortName = shortNameFactory.invert
export const shortNameSchemaChildren = shortNameFactory.schemaChildren
export const standardizeShortNameConsumer = shortNameFactory.standardizeConsumer

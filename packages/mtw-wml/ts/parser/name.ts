import { ParseNameTag } from "./baseClasses"
import parseTaggedMessageContentsFactory from "./taggedMessage"

export const parseNameFactory = parseTaggedMessageContentsFactory<ParseNameTag>('Name', ['String', 'Space'])

export default parseNameFactory

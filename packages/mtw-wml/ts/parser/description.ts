import { ParseDescriptionTag } from "./baseClasses"
import parseTaggedMessageContentsFactory from "./taggedMessage"

export const parseDescriptionFactory = parseTaggedMessageContentsFactory<ParseDescriptionTag>('Description', ['String', 'Link', 'br', 'Space'])

export default parseDescriptionFactory

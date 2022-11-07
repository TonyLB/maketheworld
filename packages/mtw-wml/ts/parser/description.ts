import { ParseDescriptionTag } from "./baseClasses"
import parseTaggedMessageContentsFactory from "./taggedMessage"

export const parseDescriptionFactory = parseTaggedMessageContentsFactory<ParseDescriptionTag>('Description', ['String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'])

export default parseDescriptionFactory

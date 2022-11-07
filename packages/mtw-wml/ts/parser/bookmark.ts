import { ParseBookmarkTag } from "./baseClasses"
import parseTaggedMessageContentsFactory from "./taggedMessage"

export const parseBookmarkFactory = parseTaggedMessageContentsFactory<ParseBookmarkTag>('Bookmark', ['String', 'Link', 'Bookmark', 'br', 'Space', 'If', 'Else', 'ElseIf'], { key: ['key'] })

export default parseBookmarkFactory

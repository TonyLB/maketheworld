import parseTaggedMessageContentsFactory from "./taggedMessage"

export const parseDescriptionFactory = parseTaggedMessageContentsFactory<'Description'>('Description', ['String', 'Link', 'br', 'Space'])

export default parseDescriptionFactory

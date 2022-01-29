import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'

export const wmlQuerySemantics = wmlGrammar.createSemantics()

export const wmlQueryFactory = (schema) => (searchString) => ([])

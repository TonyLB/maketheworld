//
// Parse's tokenized command skeleton (BD-21): an ordered sequence of referent spans and
// leftover text runs, deliberately with no grammatical (verb/preposition) classification --
// see AGENT.parseTokenization.planning.md's History for why that was proposed and rejected.
//

export type ObjectSpanToken = {
    type: 'objectSpan'
    span: string
}

export type TextToken = {
    type: 'text'
    text: string
}

export type ParseToken = ObjectSpanToken | TextToken

export type ParseSkeleton = ParseToken[]

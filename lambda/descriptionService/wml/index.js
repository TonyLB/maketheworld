const ohm = require('ohm-js')

const wmlSchema = String.raw`
    WorldMarkupLangage {
        Expression = TagExpression<"Layer"> | String
        TagExpression<tag> = TagOpen<tag> Expression TagClose<tag>
        String = (~ "<" ~">" any | "\\<" | "\\>" | space)*
        TagOpen<tag> = "<" tag ">"
        TagClose<tag> = "</" tag ">"
    }
`
const wmlGrammar = ohm.grammar(wmlSchema)

exports.wmlGrammar = wmlGrammar

const fs = require('fs')
const path = require('path')
const ohm = require('ohm-js')
const { compileCode } = require('./compileCode')
const { schema } = require('./semantics/schema')
const { wmlProcessDown, aggregateConditionals, assignExitContext } = require('./semantics/schema/processDown')
const { wmlProcessUp, aggregateErrors, validate } = require('./semantics/schema/processUp')

const wmlSchema = fs.readFileSync(path.join(__dirname, 'wml.ohm'))

const wmlGrammar = ohm.grammar(wmlSchema)

const wmlSemantics = wmlGrammar.createSemantics()
    .addOperation('eval', {
        string(node) {
            return this.sourceString
        },
        EmbeddedJSExpression(open, contents, close) {
            try {
                const evaluation = compileCode(`return (${contents.sourceString})`)({
                    name: 'world'
                })
                return `${evaluation}`
    
            }
            catch(e) {
                return '{#ERROR}'
            }
        },
        _iter(...nodes) {
            return nodes.map((node) => (node.eval())).join('')
        },
        TagExpression(open, contents, close) {
            return `${open.sourceString}${contents.eval()}${close.sourceString}`
        }
    })
    .addOperation('schema', schema)

const tagCondition = (tagList) => ({ tag }) => (tagList.includes(tag))

const flattenToElements = (includeFunction) => (node) => {
    const flattenedNode = includeFunction(node) ? [node] : []
    return node.contents.reduce(
        (previous, node) => ([...previous, ...flattenToElements(includeFunction)(node)]),
        flattenedNode
    )
}

const dbEntries = (match) => {
    const firstPass = wmlSemantics(match).schema()
    const secondPass = wmlProcessDown([
            aggregateConditionals(tagCondition(['Room', 'Exit'])),
            assignExitContext
        ])(firstPass)
    const thirdPass = wmlProcessUp([
            //
            // TODO: Refactor exit validation to assign roomId context as in processDown, then do the calculation (and better error message) knowing all three of
            // to, from and roomId.
            //
            validate(({ tag, to, from }) => ((tag === 'Exit' && !(to && from)) ? ['Exits must have both to and from properties (or be able to derive them from context)'] : [])),
            aggregateErrors
        ])(secondPass)
    const dbSchema = flattenToElements(tagCondition(['Room', 'Exit']))(thirdPass)
    return dbSchema
}

exports.wmlGrammar = wmlGrammar
exports.wmlSemantics = wmlSemantics
exports.dbEntries = dbEntries

const fs = require('fs')
const path = require('path')
const ohm = require('ohm-js')
const { compileCode } = require('./compileCode')
const { dbSchema } = require('./semantics/dbSchema')
const { wmlProcessDown, assignContextTagIds } = require('./semantics/dbSchema/processDown')
const { wmlProcessUp, aggregateErrors } = require('./semantics/dbSchema/processUp')

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
    .addOperation('dbSchema', dbSchema)

const dbEntries = (match) => {
    const firstPass = wmlSemantics(match).dbSchema()
    const secondPass = wmlProcessDown([
            assignContextTagIds({ Layer: 'layerId' }, ({ tag }) => (tag === 'Room'))
        ])(firstPass)
    const dbSchema = wmlProcessUp([
            aggregateErrors
        ])(secondPass)
    return dbSchema
}

exports.wmlGrammar = wmlGrammar
exports.wmlSemantics = wmlSemantics
exports.dbEntries = dbEntries

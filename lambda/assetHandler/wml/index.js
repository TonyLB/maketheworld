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

//
// TODO:  Determine whether explicitly indexing these values is worthwhile, or if the index
// is always equal to its position in the top-level output array
//
const flattenAndNumber = (includeFunction) => (node, startingIndex = 0) => {
    const flattenReducer = (previous, node) => {
        const { startingIndex: previousStartingIndex, flattenedContents: previousContents } = previous
        const newFlattenedContents = flattenAndNumber(includeFunction)(node, previousStartingIndex)
        return {
            flattenedContents: [...previousContents, ...newFlattenedContents],
            startingIndex: previousStartingIndex + newFlattenedContents.length
        }
    }
    const flattenedNode = includeFunction(node) ? [{ ...node, index: startingIndex }] : []
    const { flattenedContents } = node.contents.reduce(
        flattenReducer,
        {
            flattenedContents: [],
            startingIndex: startingIndex + flattenedNode.length
        }
    )
    return [
        ...flattenedNode,
        ...flattenedContents
    ]
}

const dbEntries = (match) => {
    const firstPass = wmlSemantics(match).dbSchema()
    const secondPass = wmlProcessDown([
            assignContextTagIds({ Layer: 'layerId' }, ({ tag }) => (tag === 'Room'))
        ])(firstPass)
    const thirdPass = wmlProcessUp([
            aggregateErrors
        ])(secondPass)
    const dbSchema = flattenAndNumber(({ tag }) => (['Room'].includes(tag)))(thirdPass)
    return dbSchema
}

exports.wmlGrammar = wmlGrammar
exports.wmlSemantics = wmlSemantics
exports.dbEntries = dbEntries

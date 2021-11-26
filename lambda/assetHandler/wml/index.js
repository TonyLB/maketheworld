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

const mergeToRooms = (elements) => {
    const shallowEqual = (listA, listB) => {
        if (listA.length !== listB.length) {
            return false
        }
        return !listA.find((condition, index) => (listB[index] !== condition))
    }
    //
    // TODO: Consider replacing render and name lists with DRY elements that manage the
    // complications of conditional lists internally
    //
    const reduceInRoomContext = ({ render: previousRender = [], exitsByConditionList: previousExits = [], name: previousName = [] }, element) => {
        const { to, display = 'replace', conditions = [], render = "", name = "" } = element
        switch(element.tag) {
            case 'Room':
                //
                // TODO: Handle modes of display other than replace
                //

                //
                // TODO: Build more sophisticated merge functionality that can tell when
                // two elements can be combined (e.g. their conditions are identical)
                //
                return {
                    render: [
                        ...previousRender,
                        ...(render ? [{ conditions, display, render }] : [])
                    ],
                    name: [
                        ...previousName,
                        ...(name ? [{ conditions, display, name }] : [])
                    ],
                    exitsByConditionList: previousExits
                }
            case 'Exit':
                const matchedExitIndex = previousExits.findIndex(({ conditions: probeConditions }) => (shallowEqual(conditions, probeConditions)))
                if (matchedExitIndex !== -1) {
                    const matchedExitConditional = previousExits[matchedExitIndex]
                    return {
                        render: previousRender,
                        name: previousName,
                        exitsByConditionList: [
                            {
                                ...matchedExitConditional,
                                exits: [
                                    ...matchedExitConditional.exits,
                                    {
                                        to
                                    }
                                ]
                            },
                            ...previousExits.slice(0, matchedExitIndex),
                            ...previousExits.slice(matchedExitIndex + 1)
                        ]
                    }
                }
                else {
                    return {
                        render: previousRender,
                        name: previousName,
                        exitsByConditionList: [
                            {
                                conditions,
                                exits: [{ to }]
                            },
                            ...previousExits
                        ]
                    }
                }
            default:
                return { render: previousRender, exitsByConditionList: previousExits, name: previousName }
        }
    }
    const roomsById = elements.reduce(
        (previous, element) => {
            const roomId = (element.tag === 'Room' && element.key) || (element.tag === 'Exit' && element.from)
            return {
                ...previous,
                [roomId]: reduceInRoomContext(previous[roomId] || { render: [], exitsByToAndFrom: [], name: [] }, element)
            }
        }, {}
    )
    return roomsById
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
    return mergeToRooms(dbSchema)
}

exports.wmlGrammar = wmlGrammar
exports.wmlSemantics = wmlSemantics
exports.dbEntries = dbEntries

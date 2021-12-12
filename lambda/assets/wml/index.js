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
    const reduceInRoomContext = ({ render: previousRender = [], exits: previousExits = [], name: previousName = [] }, element) => {
        const mergeRender = (previous = { render: [] }, { display, render }) => {
            //
            // TODO: Handle modes of display other than replace
            //
            return { display, render }
        }
        const mergeName = (previous = { render: [] }, { display, name }) => {
            //
            // TODO: Handle modes of display other than replace
            //
            return { display, name }
        }
        const mergeExit = (previous = {}, exit) => ({ exits: [
            ...(previous?.exits || []).filter((exitProbe) => (exitProbe.to !== exit.to)),
            {
                to: exit.to,
                name: exit.name ? exit.name.trim() : undefined
            }
        ]})
        const mergeSameConditions = (mergeFunction) => (previous, { conditions, ...rest }) => {
            const mergeCandidate = previous.slice(-1)[0]
            if (mergeCandidate && shallowEqual(mergeCandidate.conditions, conditions)) {
                return [
                    ...previous.slice(0, previous.length - 1),
                    { conditions, ...(mergeFunction(mergeCandidate, rest)) }
                ]
            }
            else {
                return [...previous, { conditions, ...(mergeFunction(undefined, rest)) }]
            }
        }
        const { render = "", name = "" } = element
        switch(element.tag) {
            case 'Room':
                return {
                    render: render ? mergeSameConditions(mergeRender)(previousRender, element) : previousRender,
                    name: name ? mergeSameConditions(mergeName)(previousName, element) : previousName,
                    exits: previousExits
                }
            case 'Exit':
                return {
                    render: previousRender,
                    name: previousName,
                    exits: mergeSameConditions(mergeExit)(previousExits, element)
                }
            default:
                return { render: previousRender, exits: previousExits, name: previousName }
        }
    }
    const roomsById = elements.reduce(
        (previous, element) => {
            const roomId = (element.tag === 'Room' && element.key) || (element.tag === 'Exit' && element.from)
            return {
                ...previous,
                [roomId]: reduceInRoomContext(previous[roomId] || { render: [], exits: [], name: [] }, element)
            }
        }, {}
    )
    return roomsById
}

const validatedSchema = (match) => {
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
    return thirdPass
}

const dbEntries = (schema) => {
    const dbSchema = flattenToElements(tagCondition(['Room', 'Exit']))(schema)
    return mergeToRooms(dbSchema)
}

const assetRegistryEntries = (schema) => {
    //
    // TODO:  Create a breakdown that returns an element for the Asset details, and then
    // elements (once) for each Room that associates it with that Asset and gives it its
    // global UUID (while providing a mapping back to its scoped ID inside the Asset
    // blueprint)
    //
    const elements = flattenToElements(tagCondition(['Asset', 'Room', 'Character']))(schema)
    return elements.map(({ tag, ...rest }) => {
        const { name, fileName, key, global: isGlobal } = rest
        switch(tag) {
            case 'Asset':
                return {
                    tag,
                    name,
                    fileName,
                    key
                }
            case 'Room':
                return {
                    tag,
                    name,
                    isGlobal,
                    key
                }
            case 'Character':
                return {
                    tag,
                    key,
                    fileName,
                    player: rest.player,
                    Name: rest.Name,
                    Pronouns: rest.Pronouns,
                    FirstImpression: rest.FirstImpression,
                    OneCoolThing: rest.OneCoolThing,
                    Outfit: rest.Outfit
                }
            default:
                return { tag, ...rest }
        }
    })
}

exports.wmlGrammar = wmlGrammar
exports.wmlSemantics = wmlSemantics
exports.validatedSchema = validatedSchema
exports.dbEntries = dbEntries
exports.assetRegistryEntries = assetRegistryEntries

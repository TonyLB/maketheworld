import { produce } from 'immer'

import { compileCode } from './compileCode.js'
import { schema } from './semantics/schema/index.js'
import { wmlProcessDown, aggregateConditionals, assignExitContext } from './semantics/schema/processDown/index.js'
import { wmlProcessUp, aggregateErrors, validate } from './semantics/schema/processUp/index.js'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'
import { normalize } from './normalize.js'

export { wmlGrammar }

export const wmlSemantics = wmlGrammar.createSemantics()
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
            // TODO: Handle modes of display other than after
            //
            return { display, render: [...previous.render, ...render] }
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
                [roomId]: {
                    tag: 'Room',
                    ...reduceInRoomContext(previous[roomId] || { render: [], exits: [], name: [] }, element)
                }
            }
        }, {}
    )
    return roomsById
}

export const validatedSchema = (match) => {
    const firstPass = wmlSemantics(match).schema()
    const secondPass = wmlProcessDown([
        aggregateConditionals(tagCondition(['Room', 'Exit'])),
        assignExitContext
    ])(firstPass)
    const normalized = normalize(secondPass)
    const thirdPass = wmlProcessUp([
        //
        // TODO: Refactor exit validation to assign roomId context as in processDown, then do the calculation (and better error message) knowing all three of
        // to, from and roomId.
        //
        validate(({ tag, to, from }) => ((tag === 'Exit' && !(to && from)) ? ['Exits must have both to and from properties (or be able to derive them from context)'] : [])),
        validate(({ to, from }) => ([
            ...(normalized[to] ? [] : [`To: '${to}' is not a key in this asset.`]),
            ...(normalized[from] ? [] : [`To: '${from}' is not a key in this asset.`])
        ])),
        aggregateErrors
    ])(secondPass)
    return thirdPass
}

// export const dbEntries = (schema) => {
//     const dbSchema = flattenToElements(tagCondition(['Room', 'Exit']))(schema)
//     const mergedRooms = mergeToRooms(dbSchema)
//     const programElements = flattenToElements(tagCondition(['Variable', 'Action']))(schema)
//         .reduce((previous, { key, ...rest }) => ({ ...previous, [key]: rest }), {})
//     return {
//         ...mergedRooms,
//         ...programElements
//     }
// }

export const dbEntries = (schema) => {
    const normalForm = normalize(schema)
    const exitsByRoom = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Exit'))
        .reduce((previous, { from, ...rest }) => ({ ...previous, [from]: [...(previous[from] || []), { from, ...rest }]}), {})
    const mapContextStackToConditions = ({ contextStack, ...rest }) => ({
        conditions: contextStack.map(({ key, tag, index }) => {
            if (tag !== 'Condition') {
                return ''
            }
            const appearances = normalForm[key]?.appearances || []
            const linkedAppearance = appearances.length > index ? appearances[index] : {}
            return linkedAppearance.if || ''
        }).filter((value) => (value)),
        ...rest
    })
    const shallowEqual = (listA, listB) => {
        if (listA.length !== listB.length) {
            return false
        }
        return !listA.find((condition, index) => (listB[index] !== condition))
    }
    const mergeRender = (previous = { render: [] }, { display, render }) => {
        //
        // TODO: Handle modes of display other than after
        //
        return { render: [...previous.render, ...render] }
    }
    const mergeName = (previous = { name: '' }, { display, name }) => {
        //
        // TODO: Handle modes of display other than replace
        //
        return { name }
    }
    const mergeExit = (previous = { exits: [] }, exit) => ({ exits: [
        ...(previous?.exits || []).filter((exitProbe) => (exitProbe.to !== exit.to)),
        {
            to: exit.to,
            name: exit.name ? exit.name.trim() : undefined
        }
    ]})
    const mergeConditions = (mergeFunction) => (previous, { conditions, ...rest }) => (produce(previous, (draftState) => {
        const sameItemIndex = draftState.findIndex(({ conditions: checkConditions }) => (shallowEqual(conditions, checkConditions)))
        if (sameItemIndex > -1) {
            const { conditions, ...previousRest } = draftState[sameItemIndex]
            draftState[sameItemIndex] = { conditions, ...(mergeFunction(previousRest, rest)) }
        }
        else {
            draftState.push({ conditions, ...mergeFunction(undefined, rest) })
        }
    }))
    return Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Variable', 'Action'].includes(tag)))
        .map(({ tag, key, appearances, conditions, contents, ...rest }) => {
            switch(tag) {
                case 'Room':
                    const returnVal = {
                        tag,
                        key,
                        ...rest,
                        name: appearances
                            .filter(({ name }) => (name))
                            .map(mapContextStackToConditions)
                            .reduce(mergeConditions(mergeName), []),
                        render: appearances
                            .filter(({ render }) => (render))
                            .map(mapContextStackToConditions)
                            .reduce(mergeConditions(mergeRender), []),
                        exits: (exitsByRoom[key] ?? [])
                            .reduce((previous, { appearances, to }) => ([...previous, ...appearances.map((item) => ({ ...item, to })) ]), [])
                            .map(mapContextStackToConditions)
                            .reduce(mergeConditions(mergeExit), [])
                    }
                    return returnVal
                case 'Variable':
                    return {
                        tag,
                        key,
                        default: rest.default
                    }
                case 'Action':
                    return {
                        tag,
                        key,
                        src: rest.src
                    }
            }
        })
        .filter(({ key } = {}) => (key))
        .reduce((previous, { key, ...rest }) => ({ ...previous, [key]: rest }), {})
}

export const assetRegistryEntries = (schema) => {
    const normalForm = normalize(schema)
    return Object.values(normalForm).map(({ tag, ...rest }) => {
        const { name, fileName, key, global: isGlobal, importMap, player, src } = rest
        switch(tag) {
            case 'Asset':
                return {
                    tag,
                    name,
                    fileName,
                    key,
                    player,
                    importMap,
                    zone: rest.zone
                }
            case 'Room':
                return {
                    tag,
                    name,
                    isGlobal,
                    key
                }
            case 'Variable':
                return {
                    tag,
                    key
                }
            case 'Action':
                return {
                    tag,
                    key,
                    src
                }
            case 'Character':
                return {
                    tag,
                    key,
                    fileName,
                    player,
                    Name: rest.Name,
                    Pronouns: rest.Pronouns,
                    FirstImpression: rest.FirstImpression,
                    OneCoolThing: rest.OneCoolThing,
                    Outfit: rest.Outfit
                }
        }
    }).filter((value) => (value))
}

import { produce } from 'immer'

import { compileCode } from './compileCode.js'
import { schema } from './semantics/schema/index.js'
import { wmlProcessDown, assignExitContext } from './semantics/schema/processDown/index.js'
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

export const validatedSchema = (match) => {
    const firstPass = wmlSemantics(match).schema()
    const secondPass = wmlProcessDown([
        assignExitContext
    ])(firstPass)
    const normalized = normalize(secondPass)
    const thirdPass = wmlProcessUp([
        //
        // TODO: Refactor exit validation to assign roomId context as in processDown, then do the calculation (and better error message) knowing all three of
        // to, from and roomId.
        //
        validate(({ tag, to, from }) => ((tag === 'Exit' && !(to && from)) ? ['Exits must have both to and from properties (or be able to derive them from context)'] : [])),
        validate(({ to, from, tag }) => ([
            ...((normalized[to] || !to) ? [] : [`To: '${to}' is not a key in this asset.`]),
            ...(((tag !== 'Exit') || (normalized[from] || !from)) ? [] : [`From: '${from}' is not a key in this asset.`])
        ])),
        aggregateErrors
    ])(secondPass)
    return thirdPass
}

export const dbEntries = (schema) => {
    const normalForm = normalize(schema)
    const mapContextStackToConditions = ({ contextStack, ...rest }) => ({
        conditions: contextStack.reduce((previous, { key, tag }) => {
            if (tag !== 'Condition') {
                return previous
            }
            const { if: condition = '', dependencies = [] } = normalForm[key]
            return [
                ...previous,
                {
                    if: condition,
                    dependencies
                }
            ]
        }, []),
        ...rest
    })

    return Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Feature', 'Variable', 'Action', 'Computed'].includes(tag)))
        .map(({ tag, key, appearances, ...rest }) => {
            switch(tag) {
                case 'Room':
                    const returnVal = {
                        tag,
                        key,
                        ...rest,
                        appearances: appearances
                            .map(mapContextStackToConditions)
                            .map(({ contents, location, ...remainder }) => {
                                const exitContents = contents
                                    .filter(({ tag }) => (tag === 'Exit'))
                                return {
                                    ...remainder,
                                    exits: (exitContents.length > 0)
                                        ? exitContents
                                            .map(({ key }) => {
                                                const { name, to } = normalForm[key]
                                                return { name, to }
                                            })
                                        : undefined
                                }
                            })
                    }
                    return returnVal
                case 'Feature':
                    const featureVal = {
                        tag,
                        key,
                        ...rest,
                        appearances: appearances
                            .map(mapContextStackToConditions)
                            .map(({ contents, location, ...rest }) => (rest))
                    }
                    return featureVal
                case 'Variable':
                    return {
                        tag,
                        key,
                        default: rest.default
                    }
                case 'Computed':
                    return {
                        tag,
                        key,
                        dependencies: rest.dependencies,
                        src: rest.src
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

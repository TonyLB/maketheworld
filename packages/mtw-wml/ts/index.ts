import { produce } from 'immer'

import { compileCode } from './compileCode.js'
import { schema } from './semantics/schema/index.js'
import { prettyPrint, prettyPrintShouldNest } from './semantics/schema/prettyPrint.js'
import { wmlProcessDown, assignExitContext } from './semantics/schema/processDown/index.js'
import { wmlProcessUp, aggregateErrors, validate } from './semantics/schema/processUp/index.js'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'
import { NormalCondition, normalize, NormalExit, isNormalComponent, isNormalVariable, isNormalComputed, isNormalAction } from './normalize'
import { isParseTagNesting, ParseTag } from './parser/baseClasses'

export { wmlGrammar }

export const wmlSemantics = wmlGrammar.createSemantics()
    .addOperation('eval', {
        string(node) {
            return this.sourceString
        },
        embeddedJSExpression(open, contents, close) {
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
        TagExpression(open, contents, close, spacer) {
            return `${open.sourceString}${contents.eval()}${close.sourceString}`
        }
    })
    .addOperation('schema', schema)
    .addOperation('prettyPrintShouldNest(depth)', prettyPrintShouldNest)
    .addOperation('prettyPrintWithOptions(depth, options)', prettyPrint)
    .addAttribute('prettyPrint', {
        WMLFileContents(item) {
            return this.prettyPrintWithOptions(0, {})
        }
    })

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
    const mapContextStackToConditions = <T extends { contextStack: { key: string, tag: string }[] }>({ contextStack, ...rest }: T): { conditions: { if: string; dependencies: any[] }[] } & Omit<T, 'contextStack'> => ({
        conditions: contextStack.reduce((previous, { key, tag }) => {
            if (tag !== 'Condition') {
                return previous
            }
            const { if: condition = '', dependencies = [] } = normalForm[key] as NormalCondition
            return [
                ...previous,
                {
                    if: condition,
                    dependencies
                }
            ]
        }, [] as { if: string, dependencies: any[] }[]),
        ...rest
    })

    return Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Feature', 'Variable', 'Action', 'Computed'].includes(tag)))
        .map((item) => {
            if (isNormalComponent(item)) {
                switch(item.tag) {
                    case 'Room':
                        const returnVal = {
                            ...item,
                            appearances: item.appearances
                                .map(mapContextStackToConditions)
                                .map(({ contents, location, ...remainder }) => {
                                    const exitContents = contents
                                        .filter(({ tag }) => (tag === 'Exit'))
                                    return {
                                        ...remainder,
                                        exits: (exitContents.length > 0)
                                            ? exitContents
                                                .map(({ key }) => {
                                                    const { name, to } = normalForm[key] as NormalExit
                                                    return { name, to }
                                                })
                                            : undefined
                                    }
                                })
                        }
                        return returnVal
                    case 'Feature':
                        const featureVal = {
                            ...item,
                            appearances: item.appearances
                                .map(mapContextStackToConditions)
                                .map(({ contents, location, ...rest }) => (rest))
                        }
                        return featureVal
                }
            }
            if (isNormalVariable(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    default: item.default
                }
            }
            if (isNormalComputed(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    dependencies: item.dependencies,
                    src: item.src
                }
            }
            if (isNormalAction(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    src: item.src
                }
            }
        })
        .filter((item) => (item?.key))
        .reduce((previous, item) => {
            if (!item) {
                return previous
            }
            else {
                const { key, ...rest } = item
                return { ...previous, [key]: rest }
            }
        }, {})
}

export function *depthFirstParseTagGenerator(tree: ParseTag[]): Generator<ParseTag> {
    for (const node of tree) {
        if (isParseTagNesting(node)) {
            yield* depthFirstParseTagGenerator(node.contents)
        }
        yield node
    }
}
import { produce } from 'immer'

import { compileCode } from './compileCode.js'
import { schema } from './semantics/schema/index.js'
import { prettyPrint, prettyPrintShouldNest } from './semantics/schema/prettyPrint.js'
import { wmlProcessDown, assignExitContext } from './semantics/schema/processDown/index.js'
import { wmlProcessUp, aggregateErrors, validate } from './semantics/schema/processUp/index.js'
import wmlGrammar from './wmlGrammar/wml.ohm-bundle.js'
import { NormalCondition, normalize, NormalExit, isNormalComponent, isNormalVariable, isNormalComputed, isNormalAction } from './normalize'
import { isParseExit, isParseRoom, isParseTagNesting, ParseRoomTag, ParseTag } from './parser/baseClasses'
import { LegalAssetContents, SchemaException, SchemaTag, SchemaUseTag } from './baseClasses'
import { transformWithContext } from './utils'
import schemaFromAsset from './schema/asset'
import schemaFromImport from './schema/import'

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

const schemaFromParseItem = (item: ParseTag): SchemaTag => {
    let schemaContents: SchemaTag[] = []
    if (isParseTagNesting(item)) {
        schemaContents = item.contents.map(schemaFromParseItem)
    }
    switch(item.tag) {
        case 'Asset':
            return schemaFromAsset(item, schemaContents as LegalAssetContents[])
        case 'Import':
            return schemaFromImport(item, schemaContents as SchemaUseTag[])
        default:
            return {
                tag: 'String',
                value: ''
            }
    }
}

const exitContextCallback = (item: ParseTag, context: ParseTag[]): ParseTag => {
    if (isParseExit(item)) {
        const closestRoomTag = context.reduceRight<ParseRoomTag | undefined>((previous, contextItem) => (previous ? previous : (isParseRoom(contextItem) ? contextItem : undefined)), undefined)
        if (closestRoomTag) {
            const newTo = item.to || closestRoomTag.key
            const newFrom = item.from || closestRoomTag.key
            const newKey = item.key || `${newFrom}#${newTo}`
            if (newTo !== closestRoomTag.key && newFrom !== closestRoomTag.key) {
                throw new SchemaException(`Cannot assign both to (${newTo}) and from (${newFrom}) different from containing room (${closestRoomTag.key}) in Exit tag.`, item)
            }
            if (!(newTo && newFrom)) {
                throw new SchemaException('Exits must have both to and from properties (or be able to derive them from context)', item)
            }
            return {
                ...item,
                to: newTo,
                from: newFrom,
                key: newKey
            }
        }
    }
    return item
}

export const schemaFromParse = (tags: ParseTag[]): SchemaTag[] => {
    const firstPass = transformWithContext(tags, exitContextCallback)
    return firstPass.map(schemaFromParseItem)
}
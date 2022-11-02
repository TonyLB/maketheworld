import { ArrayContents } from "../types"
import { ParseTagFactory, ParseConditionTag, isParseTagDependency, ParseConditionTypeFromContextTag, ParseStackTagEntry, parseDifferentiatingTags } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"
import { parse as acornParse} from "acorn"
import { simple as simpleWalk } from "acorn-walk"

//
// extractDependenciesFromJS is a painfully naive dependency extractor using only the barest fraction of the recursive
// scoping functionality of acorn-walk ... and will still probably be good enough for 99+% of cases
//
export const extractDependenciesFromJS = (src: string): string[] => {
    const parsedJS = acornParse(src.trim(), { ecmaVersion: 'latest' })
    let identifiedGlobals: string[] = []
    let definedLocals: string[] = []
    simpleWalk(parsedJS, {
        Identifier(node) {
            const identifier = (node as any).name
            if (!(definedLocals.includes(identifier))) {
                identifiedGlobals.push(identifier)
            }
        },
        ArrowFunctionExpression(node) {
            ((node as any).params || []).forEach(({ name }) => {
                definedLocals.push(name)
            })
        },
        VariableDeclarator(node) {
            definedLocals.push((node as any).id.name)
        }
    })
    return [...(new Set(identifiedGlobals.filter((item) => (!definedLocals.includes(item)))))]
}

export const parseConditionFactory = <T extends ParseConditionTag["contextTag"]>(contextTag: T): ParseTagFactory<ParseConditionTypeFromContextTag<T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    type ValidationType = ArrayContents<ParseConditionTypeFromContextTag<T>["contents"]>
    const parsedContents = validateContents<ValidationType>({
        contents: contents.filter((item) => (!isParseTagDependency(item))),
        legalTags: parseDifferentiatingTags[contextTag] as ValidationType["tag"][],
        ignoreTags: ['Comment', ...(('Whitespace' in parseDifferentiatingTags[contextTag]) ? [] : ['Whitespace'] as 'Whitespace'[])]
    }) as ParseConditionTypeFromContextTag<T>["contents"]
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'If',
            contextTag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parsedContents,
            dependencies: extractDependenciesFromJS(validate.if)
        }
    } as ParseStackTagEntry<ParseConditionTypeFromContextTag<T>>
}

export default parseConditionFactory

import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { PrintMapOptionsChange, PrintMapOptionsFactory, ValidationTemplate, ValidationTemplateOutput } from "./baseClasses"
import { parse as acornParse} from "acorn"
import { simple as simpleWalk } from "acorn-walk"

export const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const unmatchedKey = parse.properties.find(({ key }) => (!((key ?? 'DEFAULT') in template)))
    if (unmatchedKey) {
        throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${parse.tag}' items.`)
    }
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        const matchedKey = parse.properties.find(({ key: checkKey }) => ((checkKey || 'DEFAULT') === key))
        if (required && !matchedKey) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }
        if (matchedKey && matchedKey.type !== type) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : type === ParsePropertyTypes.Expression ? 'Expression' : type === ParsePropertyTypes.Literal ? 'Literal' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        if (matchedKey) {
            return { [key]: matchedKey.value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

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

export const optionsFactory: PrintMapOptionsFactory = (action) => (previous) => {
    switch(action) {
        case PrintMapOptionsChange.Sibling:
            return previous
        case PrintMapOptionsChange.Indent:
            return {
                ...previous,
                indent: previous.indent + 1
            }
    }
    return previous
}

import { parse as acornParse, Identifier } from "acorn"
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
            const identifier = node.name
            if (!(definedLocals.includes(identifier))) {
                identifiedGlobals.push(identifier)
            }
        },
        ArrowFunctionExpression(node) {
            (node.params || []).forEach((param) => {
                definedLocals.push((param as Identifier).name)
            })
        },
        VariableDeclaration(node) {
            node.declarations.forEach((declaration) => {
                definedLocals.push((declaration.id as Identifier).name)
            })
        }
    })
    return [...(new Set(identifiedGlobals.filter((item) => (!definedLocals.includes(item)))))]
}

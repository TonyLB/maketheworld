import StandardRenderString from "./string"
import StandardRenderLineBreak from "./lineBreak"
import StandardRenderLink from "./link"
import StandardRenderSpace from "./space"
import { StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"
import { excludeUndefined } from "../../lib/lists"
import { isSchemaString, isSchemaLineBreak, isSchemaLink, isSchemaSpacer } from "../../schema/baseClasses"

export class StandardRenderSimple {
    _elements: StandardRenderElement[];

    constructor(arg: any) {
        if (Array.isArray(arg) && arg.every(isRenderTreeNode)) {
            this._elements = arg
                .map<StandardRenderElement | undefined>(node => {
                    if (typeof node === 'string' || isSchemaString(node.data)) {
                        return new StandardRenderString(node)
                    }
                    else if (isSchemaLineBreak(node.data)) {
                        return new StandardRenderLineBreak(node)
                    }
                    else if (isSchemaLink(node.data)) {
                        return new StandardRenderLink(node)
                    }
                    else if (isSchemaSpacer(node.data)) {
                        return new StandardRenderSpace(node)
                    }
                    else {
                        return undefined
                    }
                })
                .filter(excludeUndefined)
        }
        else if (Array.isArray(arg) && arg.every(element => element instanceof StandardRenderAbstract)) {
            this._elements = arg
        }
        else {
            throw new Error('Invalid argument to StandardRenderSimple constructor')
        }
    }

    toJSON() {
        return this._elements.map(element => element.toJSON())
    }

    toNDJSON() {
        return this._elements.map(element => element.toNDJSON())
    }
    
    clone() {
        return new StandardRenderSimple(this.toJSON())
    }

    //
    // Merge two StandardRenderSimple objects, combining adjacent string elements
    // and treating Space elements as a single space *only* when surrounded by string elements.
    //
    merge(incoming: StandardRenderSimple): StandardRenderSimple {
        const mergedElements = [...this.clone()._elements, ...incoming.clone()._elements].reduce<StandardRenderElement[]>((previous, renderElement) => {
            if (previous.length === 0) {
                return [renderElement]
            }
            else {
                const lastElement = previous[previous.length - 1]
                if (lastElement instanceof StandardRenderSpace && renderElement instanceof StandardRenderSpace) {
                    return previous
                }
                if ((lastElement instanceof StandardRenderLineBreak || lastElement instanceof StandardRenderSpace) &&
                    (renderElement instanceof StandardRenderLineBreak || renderElement instanceof StandardRenderSpace)) {
                    return [...previous.slice(0, -1), new StandardRenderLineBreak({ data: { tag: 'br' }, children: [] })]
                }
                if (lastElement instanceof StandardRenderLineBreak && renderElement instanceof StandardRenderString) {
                    return [...previous, new StandardRenderString(renderElement.plainString.trimStart())]
                }
                if (lastElement instanceof StandardRenderString && renderElement instanceof StandardRenderLineBreak) {
                    return [...previous.slice(0, -1), new StandardRenderString(lastElement.plainString.trimEnd()), renderElement]
                }
                if (lastElement instanceof StandardRenderString && renderElement instanceof StandardRenderString) {
                    const whiteSpaceBetween = lastElement.plainString.endsWith(' ') || renderElement.plainString.startsWith(' ')
                    return [...previous.slice(0, -1), new StandardRenderString(`${lastElement.plainString.trimEnd()}${whiteSpaceBetween ? ' ' : ''}${renderElement.plainString.trimStart()}`)]
                }
                else if (previous.length > 1) {
                    const previousToLast = previous[previous.length - 2]
                    if (previousToLast instanceof StandardRenderString && lastElement instanceof StandardRenderSpace && renderElement instanceof StandardRenderString) {
                        return [...previous.slice(0, -2), new StandardRenderString(`${previousToLast.plainString.trimEnd()} ${renderElement.plainString.trimStart()}`)]
                    }
                }
                return [...previous, renderElement]
            }
        }, [])

        return new StandardRenderSimple(mergedElements)
    }
}
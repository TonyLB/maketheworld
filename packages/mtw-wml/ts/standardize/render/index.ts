import StandardRenderString from "./string"
import StandardRenderLineBreak from "./lineBreak"
import StandardRenderLink from "./link"
import StandardRenderSpace from "./space"
import { StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"
import { excludeUndefined } from "../../lib/lists"
import {
    isSchemaString,
    isSchemaLineBreak,
    isSchemaLink,
    isSchemaSpacer,
    isSchemaCondition,
    isSchemaConditionStatement,
    isSchemaConditionFallthrough,
    isSchemaRemove,
    isSchemaReplace,
    isSchemaReplaceMatch,
    isSchemaReplacePayload,
    SchemaReplaceMatchTag,
    SchemaReplacePayloadTag,
    SchemaReplaceTag,
    SchemaOutputTag,
    SchemaRemoveTag
} from "../../schema/baseClasses"
import { GenericTreeNode, GenericTreeNodeFiltered } from "../../tree/baseClasses"

type StandardRenderSimpleElement = StandardRenderString | StandardRenderLineBreak | StandardRenderLink | StandardRenderSpace | StandardRenderConditional

export class StandardRenderSimple {
    _elements: StandardRenderSimpleElement[];

    constructor(arg: any) {
        if (Array.isArray(arg) && arg.every(isRenderTreeNode)) {
            this._elements = arg
                .map<StandardRenderSimpleElement | undefined>(node => {
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
                    else if (isSchemaCondition(node.data)) {
                        return new StandardRenderConditional(node)
                    }
                    else {
                        return undefined
                    }
                })
                .filter(excludeUndefined)
        }
        else if (Array.isArray(arg) && arg.every((element): element is StandardRenderSimpleElement => (
            element instanceof StandardRenderString ||
            element instanceof StandardRenderLineBreak ||
            element instanceof StandardRenderLink ||
            element instanceof StandardRenderSpace ||
            element instanceof StandardRenderConditional
        ))) {
            this._elements = arg
        }
        else {
            throw new Error('Invalid argument to StandardRenderSimple constructor')
        }
    }

    get plainString() {
        return this._elements.map(element => element.plainString).join('')
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
                
                //
                // Combine adjacent Space tags
                //
                if (lastElement instanceof StandardRenderSpace && renderElement instanceof StandardRenderSpace) {
                    return previous
                }

                //
                // Check if both elements are either line breaks or spaces, combine to a single line break
                //
                if ((lastElement instanceof StandardRenderLineBreak || lastElement instanceof StandardRenderSpace) &&
                    (renderElement instanceof StandardRenderLineBreak || renderElement instanceof StandardRenderSpace)) {
                    return [...previous.slice(0, -1), new StandardRenderLineBreak({ data: { tag: 'br' }, children: [] })]
                }

                //
                // Trim whitespace from strings adjoining line breaks
                //
                if (lastElement instanceof StandardRenderLineBreak && renderElement instanceof StandardRenderString) {
                    return [...previous, new StandardRenderString(renderElement.plainString.trimStart())]
                }
                if (lastElement instanceof StandardRenderString && renderElement instanceof StandardRenderLineBreak) {
                    return [...previous.slice(0, -1), new StandardRenderString(lastElement.plainString.trimEnd()), renderElement]
                }

                //
                // Check if both elements are strings, join them with a maximum of one space between
                //
                if (lastElement instanceof StandardRenderString && renderElement instanceof StandardRenderString) {
                    const whiteSpaceBetween = lastElement.plainString.endsWith(' ') || renderElement.plainString.startsWith(' ')
                    return [...previous.slice(0, -1), new StandardRenderString(`${lastElement.plainString.trimEnd()}${whiteSpaceBetween ? ' ' : ''}${renderElement.plainString.trimStart()}`)]
                }

                //
                // Check if the previous two are a string followed by a Space tag, and the current element is a string, join them all with a single space
                //
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

type RenderConditionalStatement = {
    if: string
    payload: StandardRenderSimple
}

type RenderConditionalFallthrough = {
    payload: StandardRenderSimple
}

export class StandardRenderConditional extends StandardRenderAbstract implements StandardRenderElement {
    _statements: RenderConditionalStatement[]
    _fallthrough: RenderConditionalFallthrough | undefined

    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaCondition(arg.data))) {
            throw new Error('Invalid argument to StandardRenderConditional constructor')
        }
        this._statements = arg.children
            .map<RenderConditionalStatement | undefined>(node => {
                if (!(typeof node === 'string') && isSchemaConditionStatement(node.data)) {
                    return {
                        if: node.data.if,
                        payload: new StandardRenderSimple(node.children)
                    }
                }
                return undefined
            })
            .filter(excludeUndefined)
        this._fallthrough = arg.children
            .map<RenderConditionalFallthrough | undefined>(node => {
                if (!(typeof node === 'string') && isSchemaConditionFallthrough(node.data)) {
                    return {
                        payload: new StandardRenderSimple(node.children)
                    }
                }
                return undefined
            })
            .find(excludeUndefined)
        if (this._statements.length === 0) {
            throw new Error('Invalid argument to StandardRenderConditional constructor')
        }
    }

    override get plainString() {
        return this._fallthrough ? this._fallthrough.payload.plainString : ''
    }

    override toJSON() {
        return {
            data: { tag: 'If' as const },
            children: [
                ...this._statements.map(({ if: condition, payload }) => ({
                    data: { tag: 'Statement' as const, if: condition },
                    children: payload.toJSON()
                })),
                ...(this._fallthrough ? [{
                    data: { tag: 'Fallthrough' as const },
                    children: this._fallthrough.payload.toJSON()
                }] : [])
            ]
        }        
    }

    override toNDJSON() {
        return {
            data: { tag: 'If' as const },
            children: [
                ...this._statements.map(({ if: condition, payload }) => ({
                    data: { tag: 'Statement' as const, if: condition },
                    children: payload.toNDJSON()
                })),
                ...(this._fallthrough ? [{
                    data: { tag: 'Fallthrough' as const },
                    children: this._fallthrough.payload.toNDJSON()
                }] : [])
            ]
        }
    }
}

export class StandardRenderRemove extends StandardRenderAbstract implements StandardRenderElement {
    _payload: StandardRenderSimple

    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaRemove(arg.data))) {
            throw new Error('Invalid argument to StandardRenderRemove constructor')
        }
        this._payload = new StandardRenderSimple(arg.children)
    }

    override get plainString() {
        return ''
    }

    override toJSON(): GenericTreeNodeFiltered<SchemaRemoveTag, SchemaOutputTag> {
        return {
            data: { tag: 'Remove' as const },
            children: this._payload.toJSON()
        }
    }

    override toNDJSON() {
        return {
            data: { tag: 'Remove' as const },
            children: this._payload.toNDJSON()
        }
    }

}

export class StandardRenderReplace extends StandardRenderAbstract implements StandardRenderElement {
    _match: StandardRenderSimple
    _payload: StandardRenderSimple

    constructor(arg: any) {
        super()
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaReplace(arg.data))) {
            throw new Error('Invalid argument to StandardRenderReplace constructor')
        }
        this._match = new StandardRenderSimple(
            arg.children
                .filter((node): node is GenericTreeNode<SchemaReplaceMatchTag> => (typeof node !== 'string' && isSchemaReplaceMatch(node.data)))
                .map((node) => node.children)
                .flat(1)
        )

        this._payload = new StandardRenderSimple(
            arg.children
                .filter((node): node is GenericTreeNode<SchemaReplacePayloadTag> => (typeof node !== 'string' && isSchemaReplacePayload(node.data)))
                .map((node) => node.children)
                .flat(1)
        )
    }

    override get plainString() {
        return this._payload.plainString
    }

    override toJSON(): GenericTreeNodeFiltered<SchemaReplaceTag, SchemaOutputTag> {
        return {
            data: { tag: 'Replace' as const },
            children: [{
                data: { tag: 'ReplaceMatch' as const },
                children: this._match.toJSON()
            },
            {
                data: { tag: 'ReplacePayload' as const },
                children: this._payload.toJSON()
            }]
        }
    }

    override toNDJSON() {
        return {
            data: { tag: 'Replace' as const },
            children: [{
                data: { tag: 'ReplaceMatch' as const },
                children: this._match.toNDJSON()
            },
            {
                data: { tag: 'ReplacePayload' as const },
                children: this._payload.toNDJSON()
            }]
        }
    }
}

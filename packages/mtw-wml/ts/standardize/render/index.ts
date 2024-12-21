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
import { MergeConflictError } from "../baseClasses"
import { deepEqual } from "../../lib/objects"

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

    //
    // Compare two StandardRenderSimple objects, to see which of the following conditions applies:
    //    * The base object is longer than the incoming object, and the incoming object matches the end of the base object, and could be removed
    //    * The incoming object is longer than the base object, and the base object matches the end of the incoming object, so that the incoming
    //      object could be removed from the base object and leave a remainder of "removal" still to be done
    //    * The base and incoming objects are identical
    //    * The base and incoming objects are different and incoming cannot be removed from the base
    //
    compare(incoming: StandardRenderSimple): { outcome: 'Base Longer' | 'Incoming Longer' | 'Equal' | 'Conflict', remainder?: StandardRenderSimple } {

        const compareElements = (base: StandardRenderElement, incoming: StandardRenderElement): { outcome: 'Base Longer' | 'Incoming Longer' | 'Equal' | 'Conflict', remainder?: StandardRenderElement } => {
            if (base instanceof StandardRenderString && incoming instanceof StandardRenderString) {
                if (base.plainString.endsWith(incoming.plainString)) {
                    const baseFirstStringRemainder = base.plainString.slice(0, base.plainString.length - incoming.plainString.length)
                    if (!baseFirstStringRemainder) {
                        return { outcome: 'Equal' }
                    }
                    else {
                        return { outcome: 'Base Longer', remainder: new StandardRenderString(baseFirstStringRemainder) }
                    }
                }
                else if (incoming.plainString.endsWith(base.plainString)) {
                    const incomingFirstStringRemainder = incoming.plainString.slice(0, incoming.plainString.length - base.plainString.length)
                    if (!incomingFirstStringRemainder) {
                        return { outcome: 'Equal' }
                    }
                    else {
                        return { outcome: 'Incoming Longer', remainder: new StandardRenderString(incomingFirstStringRemainder) }
                    }
                }
                else if (base.plainString === incoming.plainString) {
                    return { outcome: 'Equal' }
                }
                else {
                    return { outcome: 'Conflict' }
                }
            }
            else {
                return deepEqual(base.toJSON(), incoming.toJSON()) ? { outcome: 'Equal' } : { outcome: 'Conflict' }
            }
        }
        const base = this.clone()._elements
        const incomingElements = incoming.clone()._elements
        const baseLength = base.length
        const incomingLength = incomingElements.length

        //
        // Compare the end of the base and incoming objects, to see if one is a subset of the other.
        // NOTE: While deepEqual is the right comparison for all but the *earliest* common element, the earliest common element
        // requires special handling, as it may be a string that is a subset of the other string.
        //
        if (baseLength > incomingLength) {
            const baseEnd = base.slice(baseLength - incomingLength)
            const baseFirstElementCompared = baseEnd[0]
            const incomingFirstElementCompared = incomingElements[0]
            if (baseEnd.slice(1).every((element, index) => deepEqual(element.toJSON(), incomingElements[index + 1].toJSON()))) {
                const { outcome, remainder } = compareElements(baseFirstElementCompared, incomingFirstElementCompared)
                if (outcome === 'Equal') {
                    return { outcome: 'Base Longer', remainder: new StandardRenderSimple(base.slice(0, baseLength - incomingLength)) }
                }
                if (outcome === 'Base Longer') {
                    return { outcome, remainder: new StandardRenderSimple([...base.slice(0, baseLength - incomingLength), ...remainder ? [remainder] : []]) }
                }
                if (outcome === 'Incoming Longer' || outcome === 'Conflict') {
                    return { outcome: 'Conflict' }
                }
            }
        }
        else if (incomingLength > baseLength) {
            const incomingEnd = incomingElements.slice(incomingLength - baseLength)
            const baseFirstElementCompared = base[0]
            const incomingFirstElementCompared = incomingEnd[0]
            if (incomingEnd.slice(1).every((element, index) => deepEqual(element.toJSON(), base[index + 1].toJSON()))) {
                const { outcome, remainder } = compareElements(baseFirstElementCompared, incomingFirstElementCompared)
                if (outcome === 'Equal') {
                    return { outcome: 'Incoming Longer', remainder: new StandardRenderSimple(incomingElements.slice(0, incomingLength - baseLength)) }
                }
                if (outcome === 'Incoming Longer') {
                    return { outcome, remainder: new StandardRenderSimple([...incomingElements.slice(0, incomingLength - baseLength), ...remainder ? [remainder] : []]) }
                }
                if (outcome === 'Base Longer' || outcome === 'Conflict') {
                    return { outcome: 'Conflict' }
                }
            }
        }
        else if (base.slice(1).every((element, index) => deepEqual(element.toJSON(), incomingElements[index + 1].toJSON()))) {
            const { outcome, remainder } = compareElements(base[0], incomingElements[0])
            if (outcome === 'Equal') {
                return { outcome: 'Equal' }
            }
            if (outcome === 'Base Longer') {
                return { outcome, remainder: new StandardRenderSimple([...remainder ? [remainder] : []]) }
            }
            if (outcome === 'Incoming Longer') {
                return { outcome, remainder: new StandardRenderSimple([...remainder ? [remainder] : []]) }
            }
        }
        return { outcome: 'Conflict' }
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
        if (arg instanceof StandardRenderSimple) {
            this._payload = arg
            return
        }
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

    constructor(...args: any) {
        super()
        const [arg, payloadArg] = args
        if (payloadArg && arg instanceof StandardRenderSimple && payloadArg instanceof StandardRenderSimple) {
            this._match = arg
            this._payload = payloadArg
            return
        }
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

export class StandardRender {
    _payload: StandardRenderSimple | StandardRenderRemove | StandardRenderReplace;
    
    constructor(arg: any) {
        if (arg instanceof StandardRenderSimple || arg instanceof StandardRenderRemove || arg instanceof StandardRenderReplace) {
            this._payload = arg
            return
        }
        if (Array.isArray(arg) && arg.every(isRenderTreeNode)) {
            if (arg.length === 1) {
                const node = arg[0]
                if (typeof node !== 'string') {
                    if (isSchemaRemove(node.data)) {
                        this._payload = new StandardRenderRemove(node)
                        return
                    }
                    else if (isSchemaReplace(node.data)) {
                        this._payload = new StandardRenderReplace(node)
                        return
                    }
                }
            }
            this._payload = new StandardRenderSimple(arg)
        }
        else {
            throw new Error('Invalid argument to StandardRender constructor')
        }
    }

    get plainString() {
        return this._payload.plainString
    }

    toJSON() {
        if (this._payload instanceof StandardRenderSimple) {
            return this._payload.toJSON()
        }
        else {
            return [this._payload.toJSON()]
        }
    }

    toNDJSON() {
        if (this._payload instanceof StandardRenderSimple) {
            return this._payload.toNDJSON()
        }
        else {
            return [this._payload.toNDJSON()]
        }
    }

    merge(incoming: StandardRender): StandardRender {
        const payload = this._payload
        const incomingPayload = incoming._payload
        if (payload instanceof StandardRenderSimple) {
            //
            // If both payloads are StandardRenderSimple, merge them using the StandardRenderSimple merge method
            //
            if (incomingPayload instanceof StandardRenderSimple) {
                return new StandardRender(payload.merge(incomingPayload))
            }
            //
            // To merge a StandardRenderRemove into a StandardRenderSimple, compare the matching payload and either
            // leave a Simple remainder (if the base is longer) or a Remove remainder (if the incoming is longer)
            //
            else if (incomingPayload instanceof StandardRenderRemove) {
                const { outcome, remainder } = payload.compare(incomingPayload._payload)
                if (outcome === 'Equal') {
                    return new StandardRender([])
                }
                if (outcome === 'Base Longer') {
                    return new StandardRender(remainder ?? [])
                }
                if (outcome === 'Incoming Longer') {
                    return new StandardRender(new StandardRenderRemove(remainder ?? []))
                }
                if (outcome === 'Conflict') {
                    throw new MergeConflictError()
                }
            }
            //
            // To merge a StandardRenderReplace into a StandardRenderSimple, compare the matching payload and either
            // combine the base remainder with the Replace payload (if the base is longer) or create a Replace from
            // the matching remainder and the incoming payload (if the incoming is longer)
            //
            else if (incomingPayload instanceof StandardRenderReplace) {
                const { outcome, remainder } = payload.compare(incomingPayload._match)
                if (outcome === 'Equal') {
                    return new StandardRender(incomingPayload._payload)
                }
                if (outcome === 'Base Longer') {
                    return new StandardRender(remainder ? remainder.merge(incomingPayload._payload) : incomingPayload._payload)
                }
                if (outcome === 'Incoming Longer') {
                    if (remainder) {
                        return new StandardRender(new StandardRenderReplace(remainder, incomingPayload._payload))
                    }
                    else {
                        return new StandardRender(incomingPayload._payload)
                    }
                }
                if (outcome === 'Conflict') {
                    throw new MergeConflictError()
                }
            }
        }
        //
        // If the base payload is a StandardRenderRemove, merge a simple payload into a
        // replace, merge a remove by extending the match terms, and merge a replace by
        // (similarly) extending the match terms of the replace
        //
        if (payload instanceof StandardRenderRemove) {
            if (incomingPayload instanceof StandardRenderSimple) {
                return new StandardRender(new StandardRenderReplace(payload._payload, incomingPayload))
            }
            if (incomingPayload instanceof StandardRenderRemove) {
                return new StandardRender(new StandardRenderRemove(payload._payload.merge(incomingPayload._payload)))
            }
            if (incomingPayload instanceof StandardRenderReplace) {
                const mergedMatch = payload._payload.merge(incomingPayload._match)
                return new StandardRender(new StandardRenderReplace(mergedMatch, incomingPayload._payload))
            }
        }
        //
        // If the base payload is a StandardRenderReplace, merge a simple payload by extending the
        // replace payload, merge a remove by reducing the payload (if the remove is shorter) or
        // extending the remove match terms (if it is longer), and merge a replace by chaining the
        // operations
        //
        if (payload instanceof StandardRenderReplace) {
            if (incomingPayload instanceof StandardRenderSimple) {
                return new StandardRender(new StandardRenderReplace(payload._match, payload._payload.merge(incomingPayload)))
            }
            if (incomingPayload instanceof StandardRenderRemove) {
                const { outcome, remainder } = payload._payload.compare(incomingPayload._payload)
                if (outcome === 'Equal') {
                    return new StandardRender(new StandardRenderRemove(payload._match))
                }
                if (outcome === 'Base Longer') {
                    if (remainder) {
                        return new StandardRender(new StandardRenderReplace(payload._match, remainder))
                    }
                    else {
                        return new StandardRender(new StandardRenderRemove(payload._match))
                    }
                }
                if (outcome === 'Incoming Longer') {
                    if (remainder) {
                        return new StandardRender(new StandardRenderRemove(remainder.merge(payload._match)))
                    }
                    else {
                        return new StandardRender(new StandardRenderRemove(payload._match))
                    }
                }
            }
            if (incomingPayload instanceof StandardRenderReplace) {
                const { outcome, remainder } = payload._payload.compare(incomingPayload._match)
                if (outcome === 'Equal') {
                    return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                }
                if (outcome === 'Base Longer') {
                    if (remainder) {
                        return new StandardRender(new StandardRenderReplace(payload._match, remainder.merge(incomingPayload._payload)))
                    }
                    else {
                        return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                    }
                }
                if (outcome === 'Incoming Longer') {
                    if (remainder) {
                        return new StandardRender(new StandardRenderReplace(remainder.merge(payload._match), incomingPayload._payload))
                    }
                    else {
                        return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                    }
                }
            }
        }
        throw new MergeConflictError()
    }
}
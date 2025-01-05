import StandardRenderString from "./string"
import StandardRenderLineBreak from "./lineBreak"
import StandardRenderLink from "./link"
import StandardRenderSpace from "./space"
import { RenderTree, StandardRenderAbstract, StandardRenderElement } from "./baseClasses"
import { isRenderTreeNode } from "./utils"
import { excludeUndefined } from "../../lib/lists"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { deepEqual } from "../../lib/objects"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit"

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
                // Aggregate Conditional tags that can be combined
                //
                if (lastElement instanceof StandardRenderConditional && renderElement instanceof StandardRenderConditional) {
                    const minimumLength = Math.min(lastElement._statements.length, renderElement._statements.length)
                    //
                    // Statements are incompatible if they have different conditions
                    //
                    const statementsCompatible = lastElement._statements.slice(0, minimumLength).every((statement, index) => {
                        return statement.if === renderElement._statements[index].if
                    })
                    //
                    // Fallthroughs are incompatible if they would conflict with a non-fallthrough element in a longer statement
                    // list in the other conditional
                    //
                    const fallthroughCompatible = !(
                        (lastElement._statements.length > minimumLength && renderElement._fallthrough) ||
                        (renderElement._statements.length > minimumLength && lastElement._fallthrough)
                    )
                    if (statementsCompatible && fallthroughCompatible) {
                        //
                        // Zip together the statements, leaving undefined entries in pairings of a longer statement list with a shorter
                        //
                        const zippedStatements: { previous?: RenderConditionalStatement, incoming?: RenderConditionalStatement }[] =
                            lastElement._statements.length > renderElement._statements.length
                                ? lastElement._statements.map((statement, index) => ({ previous: statement, incoming: renderElement._statements[index] }))
                                : renderElement._statements.map((statement, index) => ({ previous: lastElement._statements[index], incoming: statement }))
                        const mergedStatements = zippedStatements.map(({ previous, incoming }) => {
                            if (previous && incoming) {
                                return { if: previous.if, payload: previous.payload.merge(incoming.payload) }
                            }
                            else if (previous) {
                                return { if: previous.if, payload: previous.payload }
                            }
                            else if (incoming) {
                                return { if: incoming.if, payload: incoming.payload }
                            }
                            else {
                                throw new Error('Invalid conditional merge state')
                            }
                        })
                        const mergedConditional = new StandardRenderConditional()
                        mergedConditional._statements = mergedStatements
                        if (lastElement._fallthrough || renderElement._fallthrough) {
                            mergedConditional._fallthrough = lastElement._fallthrough && renderElement._fallthrough
                                ? { payload: lastElement._fallthrough.payload.merge(renderElement._fallthrough.payload) }
                                : lastElement._fallthrough || renderElement._fallthrough
                        }
                        return [...previous.slice(0, -1), mergedConditional]
                    }
                    else {
                        return [...previous, renderElement]
                    }
                }

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
                if (previous.length > 1) {
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
            else if (base instanceof StandardRenderString && incoming instanceof StandardRenderSpace) {
                if (base.plainString.endsWith(' ')) {
                    return { outcome: 'Base Longer', remainder: new StandardRenderString(base.plainString.slice(0, -1)) }
                }
                else {
                    return { outcome: 'Conflict' }
                }
            }
            else if (base instanceof StandardRenderSpace && incoming instanceof StandardRenderString) {
                if (incoming.plainString.startsWith(' ')) {
                    return { outcome: 'Incoming Longer', remainder: new StandardRenderString(incoming.plainString.slice(1)) }
                }
                else {
                    return { outcome: 'Conflict' }
                }
            }
            else {
                return deepEqual(base.toJSON(), incoming.toJSON()) ? { outcome: 'Equal' } : { outcome: 'Conflict' }
            }
        }
        let base = this.clone()._elements
        let incomingElements = incoming.clone()._elements

        //
        // Compare the end of the base and incoming objects, to see if one is a subset of the other.
        //
        while(base.length > 0 && incomingElements.length > 0) {
            const baseLastElement = base[base.length - 1]
            const incomingLastElement = incomingElements[incomingElements.length - 1]
            const { outcome, remainder } = compareElements(baseLastElement, incomingLastElement)
            if (outcome === 'Equal') {
                base = base.slice(0, -1)
                incomingElements = incomingElements.slice(0, -1)
            }
            else if (outcome === 'Base Longer') {
                base = [...base.slice(0, -1), remainder as StandardRenderSimpleElement]
                incomingElements = incomingElements.slice(0, -1)
            }
            else if (outcome === 'Incoming Longer') {
                base = base.slice(0, -1)
                incomingElements = [...incomingElements.slice(0, -1), remainder as StandardRenderSimpleElement]
            }
            else if (outcome === 'Conflict') {
                break
            }
        }
        if (base.length === 0 && incomingElements.length === 0) {
            return { outcome: 'Equal' }
        }
        else if (base.length === 0) {
            return { outcome: 'Incoming Longer', remainder: new StandardRenderSimple(incomingElements) }
        }
        else if (incomingElements.length === 0) {
            return { outcome: 'Base Longer', remainder: new StandardRenderSimple(base) }
        }
        else {
            return { outcome: 'Conflict' }
        }
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardRenderSimple {
        return new StandardRenderSimple(callback(this.toJSON()))
    }

}

type RenderConditionalStatement = {
    if: string
    dependencies?: string[];
    payload: StandardRenderSimple
}

type RenderConditionalFallthrough = {
    payload: StandardRenderSimple
}

export class StandardRenderConditional extends StandardRenderAbstract implements StandardRenderElement {
    _statements: RenderConditionalStatement[]
    _fallthrough: RenderConditionalFallthrough | undefined

    constructor(arg?: any) {
        super()
        if (typeof arg === 'undefined') {
            this._statements = []
            return
        }
        if (!(isRenderTreeNode(arg) && (typeof arg !== 'string') && isSchemaCondition(arg.data))) {
            throw new Error('Invalid argument to StandardRenderConditional constructor')
        }
        this._statements = arg.children
            .map<RenderConditionalStatement | undefined>(node => {
                if (!(typeof node === 'string') && isSchemaConditionStatement(node.data)) {
                    return {
                        if: node.data.if,
                        dependencies: node.data.dependencies,
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
                ...this._statements.map(({ if: condition, dependencies, payload }) => ({
                    data: { tag: 'Statement' as const, if: condition, dependencies },
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
                ...this._statements.map(({ if: condition, dependencies, payload }) => ({
                    data: { tag: 'Statement' as const, if: condition, dependencies },
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

    toJSON(): GenericTree<SchemaOutputTag> {
        if (this._payload instanceof StandardRenderSimple) {
            return this._payload.toJSON()
        }
        else {
            return [this._payload.toJSON()]
        }
    }

    toNDJSON(): RenderTree {
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
                if (deepEqual(payload._payload.toJSON(), incomingPayload.toJSON())) {
                    return new StandardRender([])
                }
                return new StandardRender(new StandardRenderReplace(payload._payload, incomingPayload))
            }
            if (incomingPayload instanceof StandardRenderRemove) {
                return new StandardRender(new StandardRenderRemove(payload._payload.merge(incomingPayload._payload)))
            }
            if (incomingPayload instanceof StandardRenderReplace) {
                const mergedMatch = payload._payload.merge(incomingPayload._match)
                if (deepEqual(mergedMatch.toJSON(), incomingPayload._payload.toJSON())) {
                    return new StandardRender([])
                }
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
                const mergedPayload = payload._payload.merge(incomingPayload)
                if (deepEqual(payload._match.toJSON(), mergedPayload.toJSON())) {
                    return new StandardRender([])
                }
                return new StandardRender(new StandardRenderReplace(payload._match, mergedPayload))
            }
            if (incomingPayload instanceof StandardRenderRemove) {
                const { outcome, remainder } = payload._payload.compare(incomingPayload._payload)
                if (outcome === 'Equal') {
                    return new StandardRender(new StandardRenderRemove(payload._match))
                }
                if (outcome === 'Base Longer') {
                    if (remainder) {
                        if (deepEqual(payload._match.toJSON(), remainder.toJSON())) {
                            return new StandardRender([])
                        }
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
                    if (deepEqual(payload._match.toJSON(), incomingPayload._payload.toJSON())) {
                        return new StandardRender([])
                    }
                    return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                }
                if (outcome === 'Base Longer') {
                    if (remainder) {
                        const mergedPayload = remainder.merge(incomingPayload._payload)
                        if (deepEqual(payload._match.toJSON(), mergedPayload.toJSON())) {
                            return new StandardRender([])
                        }
                        return new StandardRender(new StandardRenderReplace(payload._match, mergedPayload))
                    }
                    else {
                        if (deepEqual(payload._match.toJSON(), incomingPayload._payload.toJSON())) {
                            return new StandardRender([])
                        }
                        return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                    }
                }
                if (outcome === 'Incoming Longer') {
                    if (remainder) {
                        const mergedMatch = remainder.merge(payload._match)
                        if (deepEqual(mergedMatch.toJSON(), incomingPayload._payload.toJSON())) {
                            return new StandardRender([])
                        }
                        return new StandardRender(new StandardRenderReplace(mergedMatch, incomingPayload._payload))
                    }
                    else {
                        if (deepEqual(payload._match.toJSON(), incomingPayload._payload.toJSON())) {
                            return new StandardRender([])
                        }
                        return new StandardRender(new StandardRenderReplace(payload._match, incomingPayload._payload))
                    }
                }
            }
        }
        throw new MergeConflictError()
    }

    mapContents(callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>): StandardRender {
        if (this._payload instanceof StandardRenderSimple) {
            return new StandardRender(this._payload.mapContents(callback))
        }
        if (this._payload instanceof StandardRenderRemove) {
            return new StandardRender(new StandardRenderRemove(this._payload._payload.mapContents(callback)))
        }
        if (this._payload instanceof StandardRenderReplace) {
            return new StandardRender(new StandardRenderReplace(this._payload._match.mapContents(callback), this._payload._payload.mapContents(callback)))
        }
        throw new Error('Invalid StandardRender payload')
    }

}
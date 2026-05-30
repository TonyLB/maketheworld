import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { standardEditableFactory, StandardEditablePayload } from "../../../generics/editable"
import { SchemaTag, ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { isRenderTree, renderTreeToSchema } from "@tonylb/mtw-base/ts/renderTree"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardReferenceData, isStandardReferenceData } from "../dataTypes/reference"
import { StandardReference, LookupMappings } from "../reference"
import { isLegalKey } from "../../utils"
import { isSchemaTreeNode } from "../../../schema"
import { stripWrapperTag } from "../../../schema/utils"

export type ExitEndpointTag = 'From' | 'To'

const referenceFromStringBody = (value: string): StandardReference => {
    if (isSchemaComponentUUID(value)) {
        return new StandardReference(value, 'Room')
    }
    if (isLegalKey(value)) {
        return new StandardReference({ key: value, tag: 'Room' })
    }
    throw new Error(`Exit endpoint must be a ComponentUUID or legalKey, got: ${value}`)
}

const referenceToJSON = (reference: StandardReference): StandardReferenceData =>
    reference.toJSON()

export const createExitEndpointSimpleBase = (tagName: ExitEndpointTag) => {
    const endpointTagName = tagName
    return class ExitEndpointSimpleBase implements StandardEditablePayload<StandardReferenceData> {
        data: StandardReference
        _tagName: ExitEndpointTag

        constructor(data: StandardReference | ComponentUUID | string | StandardReferenceData, tag: ExitEndpointTag = endpointTagName) {
            this._tagName = tag
            if (data instanceof StandardReference) {
                this.data = data
                return
            }
            if (typeof data === 'string') {
                this.data = referenceFromStringBody(data)
                return
            }
            if (typeof data === 'object' && data !== null && isStandardReferenceData(data)) {
                this.data = new StandardReference(data)
                return
            }
            throw new Error(`Invalid ${endpointTagName} endpoint value: ${JSON.stringify(data)}`)
        }

        get schema(): GenericTree<SchemaTag> {
            const refJSON = this.data.toJSON()
            const lookedUpKey = this.data.standardKey
            const stringValue = lookedUpKey.key ?? lookedUpKey.universalKey ?? ''
            return [{ data: { tag: 'String' as const, value: stringValue }, children: [] }]
        }

        clone() {
            return new ExitEndpointSimpleBase(this.data.clone(), this._tagName)
        }

        toJSON: () => StandardReferenceData = () => referenceToJSON(this.data)
    }
}

const createEndpointPayloadFactory = (tagName: ExitEndpointTag, SimpleBase: ReturnType<typeof createExitEndpointSimpleBase>) =>
    (props: StandardReferenceData | GenericTree<SchemaTag>): InstanceType<typeof SimpleBase> | undefined => {
        if (typeof props === 'string' || (typeof props === 'object' && props !== null && !Array.isArray(props) && isStandardReferenceData(props))) {
            return new SimpleBase(props)
        }
        if (Array.isArray(props) && props.length > 0) {
            const firstElement = props[0]
            if (firstElement.data && firstElement.data.tag === tagName) {
                const combinedValue = firstElement.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('')
                if (combinedValue === '') {
                    throw new Error(`${tagName} endpoint must not be empty`)
                }
                return new SimpleBase(combinedValue)
            }
            if (props.length === 1 && isSchemaString(props[0].data)) {
                return new SimpleBase(props[0].data.value)
            }
        }
        throw new Error(`Invalid argument in ${tagName} endpoint constructor`)
    }

const endpointAdd = (base: StandardReferenceData, incoming: StandardReferenceData): StandardReferenceData => {
    const baseRef = new StandardReference(base)
    const incomingRef = new StandardReference(incoming)
    if (baseRef.sameKey(incomingRef)) {
        return base
    }
    throw new MergeConflictError('Exit endpoint values can only be merged if they match exactly. Conflicting endpoint values are not allowed.')
}

const endpointSubtract = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: StandardReferenceData, remove?: StandardReferenceData } => {
    const baseRef = new StandardReference(base)
    const incomingRef = new StandardReference(incoming)
    if (baseRef.sameKey(incomingRef)) {
        return {}
    }
    return { add: base }
}

const endpointDiff = (base: StandardReferenceData, incoming: StandardReferenceData): { add?: StandardReferenceData, remove?: StandardReferenceData } => {
    const baseRef = new StandardReference(base)
    const incomingRef = new StandardReference(incoming)
    if (baseRef.sameKey(incomingRef)) {
        return {}
    }
    return { remove: base, add: incoming }
}

export const createExitEndpointClasses = (tagName: ExitEndpointTag) => {
    const SimpleBase = createExitEndpointSimpleBase(tagName)
    const payloadFactory = createEndpointPayloadFactory(tagName, SimpleBase)

    const {
        EditableClass,
        PlainClass,
        RemoveClass,
        ReplaceClass,
        dataTypeguard: isExitEndpointData
    } = standardEditableFactory({
        typeguard: (value: unknown): value is StandardReferenceData => isStandardReferenceData(value),
        payloadFactory,
        payload: SimpleBase,
        add: endpointAdd,
        subtract: endpointSubtract,
        diff: endpointDiff,
        validateReplace: (baseAdd: StandardReferenceData, _incomingAdd: StandardReferenceData, incomingRemove: StandardReferenceData) => {
            const baseRef = new StandardReference(baseAdd)
            const removeRef = new StandardReference(incomingRemove)
            if (!baseRef.sameKey(removeRef)) {
                throw new MergeConflictError(`${tagName} Replace operation must match baseAdd with incomingRemove. Conflicting endpoint values are not allowed.`)
            }
        }
    }, `StandardExit${tagName}Endpoint`)

    class StandardExitEndpoint {
        _payload: InstanceType<typeof EditableClass>
        _tagName: ExitEndpointTag

        constructor(arg: unknown, endpointTag: ExitEndpointTag = tagName) {
            this._tagName = endpointTag
            if (arg instanceof StandardExitEndpoint) {
                this._payload = arg._payload
                return
            }
            if (arg instanceof EditableClass) {
                this._payload = arg
                return
            }

            let convertedArg: unknown = isRenderTree(arg) ? renderTreeToSchema(arg) : arg
            if (Array.isArray(convertedArg) && convertedArg.every(isSchemaTreeNode)) {
                convertedArg = stripWrapperTag(convertedArg, tagName)
            }

            const created = EditableClass.create(convertedArg as any)
            if (!created) {
                throw new Error(`${tagName} endpoint must not be empty`)
            }
            this._payload = created
        }

        get schema(): GenericTree<SchemaTag> {
            const payloadSchema = this._payload.schema
            if (this._payload instanceof PlainClass) {
                return [{ data: { tag: this._tagName }, children: payloadSchema }]
            }
            if (this._payload instanceof RemoveClass) {
                const match = (this._payload as any).match
                return [{
                    data: { tag: 'Remove' as const },
                    children: [{ data: { tag: this._tagName }, children: match?.schema ?? [] }]
                }]
            }
            if (this._payload instanceof ReplaceClass) {
                const match = (this._payload as any).match
                const payload = (this._payload as any).payload
                return [{
                    data: { tag: 'Replace' as const },
                    children: [
                        { data: { tag: 'ReplaceMatch' as const }, children: [{ data: { tag: this._tagName }, children: match?.schema ?? [] }] },
                        { data: { tag: 'ReplacePayload' as const }, children: [{ data: { tag: this._tagName }, children: payload?.schema ?? [] }] }
                    ]
                }]
            }
            return this._payload.schema
        }

        toJSON(): StandardEditableData<StandardReferenceData> {
            return this._payload.toJSON()
        }

        merge(incoming: StandardExitEndpoint): StandardExitEndpoint | undefined {
            const merged = this._payload.merge(incoming._payload)
            if (merged) {
                return new StandardExitEndpoint(merged, this._tagName)
            }
            return undefined
        }

        diff(incoming: StandardExitEndpoint | undefined): StandardExitEndpoint | undefined {
            if (!incoming) {
                const inverted = this._payload.invert()
                if (inverted) {
                    return new StandardExitEndpoint(inverted, this._tagName)
                }
                return undefined
            }
            const diffResult = this._payload.diff(incoming._payload)
            if (diffResult) {
                return new StandardExitEndpoint(diffResult, this._tagName)
            }
            return undefined
        }

        invert(): StandardExitEndpoint {
            const inverted = this._payload.invert()
            if (!inverted) {
                throw new Error(`Cannot invert empty ${this._tagName} endpoint`)
            }
            return new StandardExitEndpoint(inverted, this._tagName)
        }

        equals(other: StandardExitEndpoint): boolean {
            return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON())
        }

        lookup(mappings: LookupMappings): StandardExitEndpoint {
            if (this._payload instanceof PlainClass) {
                const plainValue = this._payload.plain?.toJSON()
                if (plainValue && isStandardReferenceData(plainValue)) {
                    const lookedUp = new StandardReference(plainValue).lookup(mappings)
                    return new StandardExitEndpoint(lookedUp.toJSON(), this._tagName)
                }
            }
            return this
        }

        toFormat(format: import("../../components/utils/references").ReferenceFormat, mappings?: LookupMappings): StandardExitEndpoint {
            if (this._payload instanceof PlainClass) {
                const plainValue = this._payload.plain?.toJSON()
                if (plainValue && isStandardReferenceData(plainValue)) {
                    const formatted = new StandardReference(plainValue).toFormat(format, mappings)
                    return new StandardExitEndpoint(formatted.toJSON(), this._tagName)
                }
            }
            return this
        }
    }

    return {
        StandardExitEndpoint,
        isExitEndpointData,
    }
}

export const { StandardExitEndpoint: StandardExitFromEndpoint } = createExitEndpointClasses('From')
export const { StandardExitEndpoint: StandardExitToEndpoint } = createExitEndpointClasses('To')

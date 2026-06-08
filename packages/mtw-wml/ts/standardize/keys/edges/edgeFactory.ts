import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaExit, isSchemaFrom, isSchemaTo, isSchemaForward, isSchemaBack } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists"
import { deepEqual } from "../../../lib/objects"
import { isSchemaTreeNode, treeFromWML } from "../../../schema"
import { splitTaggedChildren } from "../../../schema/utils"
import { ReferenceFormat } from "../../components/utils/references"
import { StandardReference, LookupMappings } from "../reference"
import { StandardExitEdgeData, isStandardExitEdgeData, isStandardExitEdgeEnvelope } from "./dataTypes/exitEdge"
import { StandardExitFromEndpoint, StandardExitToEndpoint } from "./endpointReference"
import { ExitEdgePayload, createExitEdgePayloadFromSchemaChildren } from "./exitEdgePayload"

export interface EdgeListItem {
    sameKey(other: EdgeListItem): boolean
    clone(): EdgeListItem
    merge(incoming: EdgeListItem): EdgeListItem | undefined
    diff(incoming: EdgeListItem | undefined): EdgeListItem | undefined
    invert(): EdgeListItem
    equals(other: EdgeListItem): boolean
    toJSON(): StandardEditableData<StandardExitEdgeData>
    toFormat(format: ReferenceFormat): EdgeListItem
    lookup(mappings: LookupMappings): EdgeListItem
    readonly uuid: string
}

const parseExitEdgeFromSchema = (schema: GenericTree<SchemaTag>): StandardExitEdgeData => {
    if (schema.length === 0) {
        throw new Error('Invalid schema: empty node')
    }
    const firstElement = schema[0]

    let exitNode: GenericTreeNode<SchemaTag> | undefined
    if (treeNodeTypeguard(isSchemaExit)(firstElement)) {
        exitNode = firstElement
    } else {
        const exitChild = firstElement.children?.find((child) => treeNodeTypeguard(isSchemaExit)(child))
        if (exitChild && treeNodeTypeguard(isSchemaExit)(exitChild)) {
            exitNode = exitChild
        }
    }

    if (!exitNode || !treeNodeTypeguard(isSchemaExit)(exitNode)) {
        throw new Error('Exit tag not found in schema')
    }

    const uuid = exitNode.data.uuid
    if (exitNode.data.to) {
        throw new Error('Area Exit rejects to= attribute; use From and To child tags')
    }
    if (!uuid) {
        throw new Error('Area Exit requires uuid attribute')
    }

    const hasLegacyStringBody = exitNode.children.some(({ data }) => isSchemaString(data))
    const hasTopologyChildren = exitNode.children.some(({ data }) =>
        isSchemaFrom(data) || isSchemaTo(data) || isSchemaForward(data) || isSchemaBack(data)
    )
    if (hasLegacyStringBody && !hasTopologyChildren) {
        throw new Error('Area Exit rejects legacy String body; use From, To, Forward, and Back')
    }

    const { matched: fromMatched } = splitTaggedChildren({ children: exitNode.children, tag: 'From' })
    const { matched: toMatched } = splitTaggedChildren({ children: exitNode.children, tag: 'To' })
    const { matched: forwardMatched } = splitTaggedChildren({ children: exitNode.children, tag: 'Forward' })
    const { matched: backMatched } = splitTaggedChildren({ children: exitNode.children, tag: 'Back' })

    if (fromMatched.length === 0) {
        throw new Error('Area Exit requires From child tag')
    }
    if (toMatched.length === 0) {
        throw new Error('Area Exit requires To child tag')
    }

    const from = new StandardExitFromEndpoint(fromMatched).toJSON()
    const to = new StandardExitToEndpoint(toMatched).toJSON()
    const payload = createExitEdgePayloadFromSchemaChildren(forwardMatched, backMatched).toJSON()

    return { tag: 'Exit', uuid, from, to, payload }
}

export const edgeClassFactory = (label: string) => {
    return class GeneratedExitEdgeClass implements EdgeListItem {
        _uuid: string
        _from: InstanceType<typeof StandardExitFromEndpoint>
        _to: InstanceType<typeof StandardExitToEndpoint>
        _payload: ExitEdgePayload

        constructor(
            arg: StandardExitEdgeData | GeneratedExitEdgeClass | GenericTree<SchemaTag> | StandardEditableData<StandardExitEdgeData> | string
        ) {
            if (arg instanceof GeneratedExitEdgeClass) {
                this._uuid = arg._uuid
                this._from = arg._from
                this._to = arg._to
                this._payload = new ExitEdgePayload(arg._payload)
                return
            }

            if (isStandardExitEdgeEnvelope(arg)) {
                if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Remove') {
                    const interior = new GeneratedExitEdgeClass(arg.match)
                    const inverted = interior.invert()
                    this._uuid = inverted._uuid
                    this._from = inverted._from
                    this._to = inverted._to
                    this._payload = inverted._payload
                    return
                }
                if (typeof arg === 'object' && arg !== null && 'tag' in arg && arg.tag === 'Replace') {
                    const matchEdge = new GeneratedExitEdgeClass(arg.match)
                    const payloadEdge = new GeneratedExitEdgeClass(arg.payload)
                    const diffEdge = matchEdge.diff(payloadEdge)
                    if (!diffEdge) {
                        throw new Error(`Replace operation resulted in no difference in ${label} constructor`)
                    }
                    this._uuid = diffEdge._uuid
                    this._from = diffEdge._from
                    this._to = diffEdge._to
                    this._payload = diffEdge._payload
                    return
                }
            }

            if (isStandardExitEdgeData(arg)) {
                this._uuid = arg.uuid
                this._from = new StandardExitFromEndpoint(arg.from)
                this._to = new StandardExitToEndpoint(arg.to)
                this._payload = new ExitEdgePayload(arg.payload)
                return
            }

            if (typeof arg === 'string' && (arg.includes('<') || arg.includes('['))) {
                const schema = treeFromWML(arg)
                if (schema.length === 0) {
                    throw new Error(`Invalid WML string in ${label} constructor: empty schema`)
                }
                arg = schema
            }

            if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
                const schema = arg as GenericTree<SchemaTag>
                const firstElement = schema[0]

                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    const interiorSchema = firstElement.children
                    if (interiorSchema.length === 0) {
                        throw new Error(`Remove wrapper must have children in ${label} constructor`)
                    }
                    const interiorEdge = new GeneratedExitEdgeClass(interiorSchema)
                    const inverted = interiorEdge.invert()
                    this._uuid = inverted._uuid
                    this._from = inverted._from
                    this._to = inverted._to
                    this._payload = inverted._payload
                    return
                }

                if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    const replaceMatch = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
                    const replacePayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload))
                    if (!replaceMatch || !replacePayload) {
                        throw new Error(`Replace must have both a ReplaceMatch and a ReplacePayload in ${label} constructor`)
                    }
                    const matchEdge = new GeneratedExitEdgeClass(replaceMatch.children)
                    const payloadEdge = new GeneratedExitEdgeClass(replacePayload.children)
                    if (!matchEdge.sameKey(payloadEdge)) {
                        throw new Error(`Replace match and payload must have the same uuid in ${label} constructor`)
                    }
                    const diffEdge = matchEdge.diff(payloadEdge)
                    if (!diffEdge) {
                        throw new Error(`Replace operation resulted in no difference in ${label} constructor`)
                    }
                    this._uuid = diffEdge._uuid
                    this._from = diffEdge._from
                    this._to = diffEdge._to
                    this._payload = diffEdge._payload
                    return
                }

                const parsed = parseExitEdgeFromSchema(schema)
                this._uuid = parsed.uuid
                this._from = new StandardExitFromEndpoint(parsed.from)
                this._to = new StandardExitToEndpoint(parsed.to)
                this._payload = new ExitEdgePayload(parsed.payload)
                return
            }

            throw new Error(`Invalid argument to ${label} constructor`)
        }

        _wrap(instance: GeneratedExitEdgeClass): this {
            return instance as this
        }

        get uuid(): string {
            return this._uuid
        }

        get from(): InstanceType<typeof StandardExitFromEndpoint> {
            return this._from
        }

        get to(): InstanceType<typeof StandardExitToEndpoint> {
            return this._to
        }

        get payload(): ExitEdgePayload {
            return this._payload
        }

        clone(): GeneratedExitEdgeClass {
            return this._wrap(new GeneratedExitEdgeClass(this))
        }

        toJSON(): StandardEditableData<StandardExitEdgeData> {
            return {
                tag: 'Exit',
                uuid: this._uuid,
                from: this._from.toJSON(),
                to: this._to.toJSON(),
                payload: this._payload.toJSON(),
            }
        }

        schema(): GenericTreeNode<SchemaTag> {
            return {
                data: { tag: 'Exit', uuid: this._uuid },
                children: [
                    ...this._from.schema,
                    ...this._to.schema,
                    ...this._payload.schemaChildren(),
                ],
            }
        }

        equals(other: GeneratedExitEdgeClass): boolean {
            if (!this.sameKey(other)) {
                return false
            }
            return deepEqual(this.toJSON(), other.toJSON())
        }

        sameKey(other: GeneratedExitEdgeClass): boolean {
            return this._uuid === other._uuid
        }

        merge(incoming: GeneratedExitEdgeClass): GeneratedExitEdgeClass | undefined {
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot merge edges with different uuid values')
            }
            const mergedFrom = this._from.merge(incoming._from)
            const mergedTo = this._to.merge(incoming._to)
            const mergedPayload = this._payload.merge(incoming._payload)
            if (!mergedFrom && !mergedTo && !mergedPayload) {
                return undefined
            }
            const result = new GeneratedExitEdgeClass({
                tag: 'Exit',
                uuid: this._uuid,
                from: (mergedFrom ?? this._from).toJSON(),
                to: (mergedTo ?? this._to).toJSON(),
                payload: (mergedPayload ?? this._payload).toJSON(),
            })
            return this._wrap(result)
        }

        diff(incoming: GeneratedExitEdgeClass | undefined): GeneratedExitEdgeClass | undefined {
            if (!incoming) {
                return this.invert()
            }
            if (!this.sameKey(incoming)) {
                throw new Error('Cannot diff edges with different uuid values')
            }
            const diffFrom = this._from.diff(incoming._from)
            const diffTo = this._to.diff(incoming._to)
            const diffPayload = this._payload.diff(incoming._payload)
            if (!diffFrom && !diffTo && !diffPayload) {
                return undefined
            }
            const result = new GeneratedExitEdgeClass({
                tag: 'Exit',
                uuid: this._uuid,
                from: (diffFrom ?? this._from).toJSON(),
                to: (diffTo ?? this._to).toJSON(),
                payload: (diffPayload ?? this._payload).toJSON(),
            })
            return this._wrap(result)
        }

        invert(): GeneratedExitEdgeClass {
            const result = new GeneratedExitEdgeClass({
                tag: 'Exit',
                uuid: this._uuid,
                from: this._from.invert().toJSON(),
                to: this._to.invert().toJSON(),
                payload: this._payload.invert().toJSON(),
            })
            return this._wrap(result)
        }

        toFormat(format: ReferenceFormat): GeneratedExitEdgeClass {
            const result = new GeneratedExitEdgeClass({
                tag: 'Exit',
                uuid: this._uuid,
                from: this._from.toFormat(format).toJSON(),
                to: this._to.toFormat(format).toJSON(),
                payload: this._payload.toFormat(format).toJSON(),
            })
            return this._wrap(result)
        }

        lookup(mappings: LookupMappings): GeneratedExitEdgeClass {
            const result = new GeneratedExitEdgeClass({
                tag: 'Exit',
                uuid: this._uuid,
                from: this._from.lookup(mappings).toJSON(),
                to: this._to.lookup(mappings).toJSON(),
                payload: this._payload.lookup(mappings).toJSON(),
            })
            return this._wrap(result)
        }
    }
}

export const validateAreaExitSchemaNode = (exitNode: GenericTreeNode<SchemaTag>): void => {
    if (!treeNodeTypeguard(isSchemaExit)(exitNode)) {
        throw new Error('Expected Exit schema node')
    }
    parseExitEdgeFromSchema([exitNode])
}

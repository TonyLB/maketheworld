import { deepEqual } from "../../lib/objects";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { MergeConflictError, StandardRemove, StandardReplace } from "../baseClasses";
import { isStandardRemoveWithOptions, isStandardReplaceWithOptions } from "./dataTypes";
import { ComponentInterface } from "./abstract";
import { StandardComponentNonEditData } from "./dataTypes";
import { isSchemaTreeNode } from "./utils";
import { isLegalKey, nodeFromWML } from "../utils";

interface EditWrappable extends ComponentInterface {
    isRemove: boolean;
    isReplace: boolean;
    match: ComponentInterface | undefined;
    payload: ComponentInterface;
}

export const editWrap = <TBase extends new (...args: any[]) => ComponentInterface>(Base: TBase, label: string, options: { typeGuard?: (value: any) => boolean } = {}) => {
    return class EditWrapped extends Base implements EditWrappable {
        _remove?: boolean;
        _match?: InstanceType<typeof Base>;

        constructor(...allArgs: any[]) {
            const rawArgs = allArgs[0]
            const args = rawArgs instanceof Base ? rawArgs.toJSON() : rawArgs
            if (!args || typeof args === 'string' && isLegalKey(args)) {
                return
            }
            if (isSchemaTreeNode(args) || typeof args === 'string') {
                const node = typeof args === 'string'
                    ? nodeFromWML(args)
                    : args
                if (treeNodeTypeguard(isSchemaRemove)(node)) {
                    const childImports = node.children
                    if (childImports.length !== 1) {
                        throw new Error(`Remove error in ${label}`)
                    }
                    super(childImports[0])
                    this._remove = true
                }
                else if (treeNodeTypeguard(isSchemaReplace)(node)) {
                    const payloadValues = node.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1)
                    const matchValues = node.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1)
                    if (payloadValues.length !== 1 || matchValues.length !== 1) {
                        throw new Error(`Replace error in ${label}`)
                    }
                    super(payloadValues[0])
                    this._match = new Base(matchValues[0]) as InstanceType<typeof Base>
                }
                else {
                    super(args)
                }
                return
            }    
            if (isStandardRemoveWithOptions(options)(args)) {
                super(args.component)
                this._remove = true
                return
            }
            if (isStandardReplaceWithOptions(options)(args)) {
                super(args.payload)
                this._match = new Base(args.match) as InstanceType<typeof Base>
                return
            }
            if ('tag' in args) {
                super(args)
                return
            }
            throw new Error(`Invalid arguments in ${label} constructor`)
        }

        get isRemove() { return Boolean(this._remove) }
        get isReplace() { return Boolean(this._match) }
        get match() { return this._match }
        get payload() {
            return new EditWrapped(new Base(super.toJSON())) as this
        }

        override clone(): this {
            const returnValue = this.payload
            returnValue._remove = this._remove
            returnValue._match = this._match
            
            return returnValue
        }

        override toJSON(): ReturnType<(InstanceType<typeof Base>)["toJSON"]> | StandardRemove | StandardReplace {
            const payload = super.toJSON() as ReturnType<(InstanceType<typeof Base>)["toJSON"]>
            if (this.isRemove) {
                return {
                    tag: 'Remove' as const,
                    key: payload.key,
                    component: payload as StandardComponentNonEditData
                }
            }
            if (this.isReplace) {
                const match = this.match
                if (!match) {
                    throw new Error('No match in StandardComponent replace')
                }
                return {
                    tag: 'Replace' as const,
                    key: payload.key,
                    payload: payload as StandardComponentNonEditData,
                    match: match.toJSON() as StandardComponentNonEditData
                }
            }
            return payload
        }

        override get schema(): GenericTreeNode<SchemaTag> {
            if (this._remove) {
                return {
                    data: { tag: 'Remove' as const },
                    children: [super.schema]
                }
            }
            if (this._match) {
                return {
                    data: { tag: 'Replace' as const },
                    children: [
                        { data: { tag: 'ReplaceMatch' }, children: [this._match.schema] },
                        { data: { tag: 'ReplacePayload' }, children: [super.schema] }
                    ]
                }    
            }
            return super.schema
        }

        override merge(incoming: this): this | undefined {
            if (incoming.key !== this.key) {
                throw new Error(`Source mismatch in ${label} merge`)
            }
            if (incoming.isRemove) {
                const incomingPayload = incoming.clone() as this
                incomingPayload._remove = undefined
                if (this._match) {
                    const basePayload = this.clone()
                    basePayload._match = undefined
                    if (!deepEqual(basePayload.schema, incomingPayload.schema)) {
                        throw new MergeConflictError()
                    }
                    const returnValue = new EditWrapped(this._match.clone()) as this
                    returnValue._remove = true
                    return returnValue
                }
                else {
                    if (!deepEqual(this.schema, incomingPayload.schema)) {
                        throw new MergeConflictError()
                    }
                    return undefined
                }
            }
            if (incoming._match) {
                if (this._remove) {
                    throw new MergeConflictError()
                }
                if (this._match) {
                    const basePayload = this.clone()
                    basePayload._match = undefined
                    if (!deepEqual(basePayload.schema, incoming._match.schema)) {
                        throw new MergeConflictError()
                    }
                    const returnValue = incoming.clone() as this
                    returnValue._match = this._match.clone() as InstanceType<TBase>
                    return returnValue
                }
                const incomingPayload = incoming.clone() as this
                incomingPayload._match = undefined
                return incomingPayload
            }
            if (this.isRemove) {
                const incomingPayload = incoming.clone() as this
                incomingPayload._match = this.payload as InstanceType<TBase>
                return incomingPayload
            }
            const mergedOutput = super.merge(incoming)
            if (!mergedOutput) {
                return undefined
            }
            return new EditWrapped(mergedOutput) as this
        }
    }
}

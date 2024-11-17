import { deepEqual } from "../../lib/objects";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { isStandardRemove, isStandardReplace, MergeConflictError, StandardComponentData, StandardRemove, StandardReplace } from "../baseClasses";
import StandardComponentAbstract, { ComponentInterface } from "./abstract";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./dataTypes";
import { isSchemaTreeNode } from "./utils";

interface EditWrappable extends ComponentInterface {
    isRemove: boolean;
    isReplace: boolean;
    match: ComponentInterface | undefined;
    payload: ComponentInterface;
}

export const editWrap = <TBase extends new (...args: any[]) => ComponentInterface>(Base: TBase, label: string) => {
    return class EditWrapped extends Base implements EditWrappable {
        _remove?: boolean;
        _match?: InstanceType<typeof Base>;

        constructor(...allArgs: any[]) {
            const args = allArgs[0]
            if (args instanceof Base) {
                super(args.toJSON())
            }
            else if ('tag' in args) {
                if (isStandardRemove(args)) {
                    super(args.component)
                    this._remove = true
                }
                else if (isStandardReplace(args)) {
                    super(args.payload)
                    this._match = new Base(args.match) as InstanceType<typeof Base>
                }
                else {
                    super(args)
                }
            }
            else {
                if (!isSchemaTreeNode(args)) {
                    throw new Error(`Invalid arguments in ${label} constructor`)
                }
                if (treeNodeTypeguard(isSchemaRemove)(args)) {
                    const childImports = args.children
                    if (childImports.length !== 1) {
                        throw new Error(`Remove error in ${label}`)
                    }
                    super(childImports[0])
                    this._remove = true
                }
                else if (treeNodeTypeguard(isSchemaReplace)(args)) {
                    const payloadValues = args.children.filter(treeNodeTypeguard(isSchemaReplacePayload)).map(({ children }) => (children)).flat(1)
                    const matchValues = args.children.filter(treeNodeTypeguard(isSchemaReplaceMatch)).map(({ children }) => (children)).flat(1)
                    if (payloadValues.length !== 1 || matchValues.length !== 1) {
                        throw new Error(`Replace error in ${label}`)
                    }
                    super(payloadValues[0])
                    this._match = new Base(matchValues[0]) as InstanceType<typeof Base>
                }
                else {
                    super(args)
                }
            }
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
            return new EditWrapped(super.merge(incoming)) as this
        }
    }
}

type ConstructorArgs = StandardComponentData | GenericTreeNode<SchemaTag>

export const unwrapConstructorArgs = (args: ConstructorArgs): { payload: ConstructorArgs, remove: boolean, match?: ConstructorArgs } => {
    if (isSchemaTreeNode(args)) {
        if (treeNodeTypeguard(isSchemaRemove)(args)) {
            if (args.children.length < 1) {
                throw new Error('Empty remove tag')
            }
            return { payload: args.children[0], remove: true }
        }
        if (treeNodeTypeguard(isSchemaReplace)(args)) {
            const payload = args.children.find(treeNodeTypeguard(isSchemaReplacePayload))
            const match = args.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
            if (!payload) {
                throw new Error('Replace without payload')
            }
            if (!match) {
                throw new Error('Replace without match')
            }
            return { payload: payload.children[0], match: match.children[0], remove: false }
        }
        return { payload: args, remove: false }
    }
    else {
        if (isStandardRemove(args)) {
            return { payload: args.component, remove: true }
        }
        if (isStandardReplace(args)) {
            return { payload: args.payload, match: args.match, remove: false }
        }
        return { payload: args, remove: false }
    }
}

type JSONCallback<T extends StandardComponentAbstract, O extends StandardComponentNonEditData> = (value: T) => O;

export const wrapJSON = <T extends StandardComponentAbstract, O extends StandardComponentNonEditData>(item: T, callback: JSONCallback<T, O>): O | StandardRemoveData | StandardReplaceData => {
    const payload = callback(item)
    if (item.isRemove) {
        return {
            tag: 'Remove' as const,
            key: payload.key,
            component: payload
        }
    }
    if (item.isReplace) {
        const match = item.match
        if (!match) {
            throw new Error('No match in StandardComponent replace')
        }
        return {
            tag: 'Replace' as const,
            key: payload.key,
            payload,
            match: callback(match as unknown as T)
        }
    }
    return payload
}

type SchemaCallback<T extends StandardComponentAbstract> = (value: T) => GenericTreeNode<SchemaTag>;

export const wrapSchema = <T extends StandardComponentAbstract>(item: T, callback: SchemaCallback<T>): GenericTreeNode<SchemaTag> => {
    const payload = callback(item)
    if (item.isRemove) {
        return {
            data: { tag: 'Remove' },
            children: [payload]
        }
    }
    if (item.isReplace) {
        const match = item.match
        if (!match) {
            throw new Error('No match in StandardComponent replace')
        }
        return {
            data: { tag: 'Replace' },
            children: [
                { data: { tag: 'ReplaceMatch' }, children: [callback(match as unknown as T)] },
                { data: { tag: 'ReplacePayload' }, children: [payload] }
            ]
        }
    }
    return payload
}

type MergeCallback<T extends StandardComponentAbstract> = (base: T, incoming: T) => T;

export const wrapMerge = <T extends StandardComponentAbstract>(base: T, incoming: T, classRef: new (...args: any[]) => T, callback: MergeCallback<T>): T | undefined => {
    if (incoming.isRemove) {
        const payload = base.payload as T
        if (base.isRemove || !deepEqual(payload.toJSON(), incoming.payload.toJSON())) {
            throw new MergeConflictError()
        }
        if (base.isReplace) {
            const match = base.match?.toJSON()
            return new classRef({
                tag: 'Remove',
                key: base.key,
                component: match
            })
        }
        return undefined
    }
    if (incoming.isReplace) {
        const payload = base.payload as T
        if (base.isRemove || !deepEqual(payload.toJSON(), incoming.match?.toJSON())) {
            throw new MergeConflictError()
        }
        if (base.isReplace) {
            return new classRef({
                tag: 'Replace',
                key: base.key,
                match: base.match,
                payload: incoming.payload
            })
        }
        return incoming.payload as T
    }
    return callback(base, incoming)
}
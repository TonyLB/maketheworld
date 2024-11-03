import { deepEqual } from "../../lib/objects";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaTag } from "../../schema/baseClasses";
import { GenericTreeNode, treeNodeTypeguard } from "../../tree/baseClasses";
import { isStandardRemove, isStandardReplace, MergeConflictError, StandardComponentData } from "../baseClasses";
import StandardComponentAbstract from "./abstract";
import { StandardComponentNonEditData, StandardRemoveData, StandardReplaceData } from "./dataTypes";
import { isSchemaTreeNode } from "./utils";

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
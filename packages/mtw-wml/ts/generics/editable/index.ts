import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { deepEqual } from '../../lib/objects';
import { isSchemaTreeNode } from '../../standardize/components/utils';
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from '@tonylb/mtw-base/ts/schema/edit';
import { nodeFromWML, treeFromWML } from '../../standardize/utils';

export interface StandardEditablePayload<DataType> {
    clone: () => StandardEditablePayload<DataType>;
    toJSON: () => DataType;
    schema: GenericTree<SchemaTag>;
    add: (base: DataType, incoming: DataType) => DataType;
    subtract: (base: DataType, incoming: DataType, options?: { fromStart?: boolean }) => StandardEditableDataDelta<DataType>;
    diff: (base: DataType, incoming: DataType) => StandardEditableDataDelta<DataType>;
}

export type StandardEditablePayloadDelta<DataType> = { remove?: StandardEditablePayload<DataType>; add?: StandardEditablePayload<DataType> }
export type StandardEditableDataDelta<DataType> = { remove?: DataType; add?: DataType }

type PayloadDataType<Payload extends StandardEditablePayload<any>> = Payload extends StandardEditablePayload<infer D> ? D : never;

export interface StandardEditableWrapper<PayloadType extends StandardEditablePayload<any>> {
    clone: () => StandardEditableWrapper<PayloadType>;
    toJSON: () => StandardEditableData<PayloadDataType<PayloadType>>;
    schema: GenericTree<SchemaTag>;
    merge: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    diff: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    plain: PayloadType | undefined;
}

export type StandardEditableFactoryProps<DataType> = {
    typeguard: (value: any) => value is DataType;
    payloadFactory: (props: StandardEditableData<DataType> | GenericTree<SchemaTag>) => StandardEditablePayload<DataType> | undefined;
    payload: new (props: DataType) => StandardEditablePayload<DataType>;
}

export type StandardEditableFactoryReturn<FinalType extends StandardEditablePayload<any>> = {
    contentClass: new (data: PayloadDataType<FinalType> | FinalType) => StandardEditableWrapper<FinalType>;
    removeClass: new (match: PayloadDataType<FinalType> | FinalType) => StandardEditableWrapper<FinalType>;
    replaceClass: new (match: PayloadDataType<FinalType> | FinalType, payload: PayloadDataType<FinalType> | FinalType) => StandardEditableWrapper<FinalType>;
    factory: (props: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag>) => StandardEditableWrapper<FinalType> | undefined;
    typeguard: (x: any) => x is StandardEditableData<PayloadDataType<FinalType>>;
}

const addDelta = <FinalType extends StandardEditablePayload<any>>(
        add: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => PayloadDataType<FinalType>,
        subtract: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>, options?: { fromStart?: boolean }) => StandardEditableDataDelta<PayloadDataType<FinalType>>,
        diff: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>, options?: { fromStart?: boolean }) => StandardEditableDataDelta<PayloadDataType<FinalType>>
    ) => (
        base: StandardEditableDataDelta<PayloadDataType<FinalType>>,
        incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>
    ): StandardEditablePayloadDelta<PayloadDataType<FinalType>> => {
    const { add: baseAdd, remove: baseRemove } = base
    const { add: incomingAdd, remove: incomingRemove } = incoming
    if (baseAdd && incomingRemove) {
        //
        // In this case, we need to cancel out any of the baseAdd that is being removed by the incomingRemove.
        // We also need to throw any MergeConflicts taht subtract might generate: If the baseAdd cannot
        // be reconciled with the incomingRemove, that is a failure state.
        //
        const cancelledDelta = subtract(baseAdd, incomingRemove)
        return addDelta(add, subtract, diff)(
            { add: cancelledDelta.add, remove: baseRemove },
            { add: incomingAdd, remove: cancelledDelta.remove }
        )

    }
    const cancelledRemove = baseRemove && incomingRemove ? add(incomingRemove, baseRemove) : baseRemove ?? incomingRemove
    const cancelledAdd = baseAdd && incomingAdd ? add(baseAdd, incomingAdd) : baseAdd ?? incomingAdd
    return (cancelledAdd && cancelledRemove)
        ? diff(cancelledRemove, cancelledAdd)
        : { add: cancelledAdd, remove: cancelledRemove }
}

const diffDelta = <FinalType extends StandardEditablePayload<any>>(
    add: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => PayloadDataType<FinalType>,
    subtract: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => StandardEditableDataDelta<PayloadDataType<FinalType>>,
    diff: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => StandardEditableDataDelta<PayloadDataType<FinalType>>
) => (
    base: StandardEditableDataDelta<PayloadDataType<FinalType>>,
    incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>
): StandardEditablePayloadDelta<PayloadDataType<FinalType>> => {
    const { add: baseAdd, remove: baseRemove } = base
    return addDelta(add, subtract, diff)(
        { add: baseRemove, remove: baseAdd },
        incoming
    )
}        

export const standardEditableFactory = <FinalType extends StandardEditablePayload<any>>(props: StandardEditableFactoryProps<PayloadDataType<FinalType>>): StandardEditableFactoryReturn<FinalType> => {
    class GeneratedContentClass implements StandardEditableWrapper<FinalType> {
        payload: FinalType;
        constructor(payload: PayloadDataType<FinalType> | FinalType) {
            if (props.typeguard(payload)) {
                const result = props.payloadFactory(payload)
                if (result) {
                    this.payload = result as FinalType
                    return
                }
            }
            if (payload instanceof props.payload) {
                this.payload = payload
                return
            }
            if (isSchemaTreeNode(payload)) {
                const result = props.payloadFactory(payload)
                if (result) {
                    this.payload = result as FinalType                    
                    return
                }
            }
            console.log(`Invalid payload: ${JSON.stringify(payload)}`)
            throw new Error('Invalid payload')
        }
        clone() {
            const result = this.payload.toJSON()
            if (props.typeguard(result)) {
                return new GeneratedContentClass(result)
            }
            throw new Error('Invalid payload')
        }
        toJSON() {
            return this.payload.toJSON()
        }
        get schema() {
            return this.payload.schema
        }
        merge(incoming: StandardEditableWrapper<FinalType>) {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = addDelta(this.payload.add, this.payload.subtract, this.payload.diff)({ add: this.payload.toJSON() }, delta)
            if (remove) {
                if (add) {
                    return new GeneratedReplaceClass(remove as FinalType, add as FinalType)
                }
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        diff(incoming: StandardEditableWrapper<FinalType>): StandardEditableWrapper<FinalType> | undefined {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = diffDelta(this.payload.add, this.payload.subtract, this.payload.diff)({ add: this.payload.toJSON() }, delta)
            if (remove) {
                if (add) {
                    return new GeneratedReplaceClass(remove as FinalType, add as FinalType)
                }
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        get plain() {
            return this.payload
        }
    }

    class GeneratedRemoveClass implements StandardEditableWrapper<FinalType> {
        matchData: FinalType;
        constructor(payload: PayloadDataType<FinalType> | FinalType) {
            if (props.typeguard(payload)) {
                const result = props.payloadFactory(payload)
                if (result) {
                    this.matchData = result as FinalType
                    return
                }
            }
            else {
                if (payload instanceof props.payload) {
                    this.matchData = payload
                    return
                }
            }
            throw new Error('Invalid payload')
        }
        get match() { return this.matchData }
        clone() {
            return new GeneratedRemoveClass(this.match)
        }
        toJSON() {
            return { tag: 'Remove' as const, match: this.match.toJSON() }
        }
        get schema() {
            return [{
                data: { tag: 'Remove' as const },
                children: this.match.schema
            }]
        }
        merge(incoming: StandardEditableWrapper<FinalType>) {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = addDelta(this.match.add, this.match.subtract, this.match.diff)({ remove: this.match.toJSON() }, delta)
            if (remove) {
                if (add) {
                    return new GeneratedReplaceClass(remove as FinalType, add as FinalType)
                }
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        diff(incoming: StandardEditableWrapper<FinalType>) {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = diffDelta(this.match.add, this.match.subtract, this.match.diff)({ remove: this.match.toJSON() }, delta)
            if (remove) {
                if (add) {
                    return new GeneratedReplaceClass(remove as FinalType, add as FinalType)
                }
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        get plain() {
            return this.match
        }
    }

    class GeneratedReplaceClass implements StandardEditableWrapper<FinalType> {
        matchData: FinalType;
        payloadData: FinalType;
        constructor(match: PayloadDataType<FinalType> | FinalType, payload: PayloadDataType<FinalType> | FinalType) {
            if (props.typeguard(match) && props.typeguard(payload)) {
                const matchResult = props.payloadFactory(match)
                const payloadResult = props.payloadFactory(payload)
                if (matchResult && payloadResult) {
                    this.matchData = matchResult as FinalType
                    this.payloadData = payloadResult as FinalType
                    return
                }
            }
            if (payload instanceof props.payload && match instanceof props.payload) {
                this.matchData = match
                this.payloadData = payload
                return
            }
            throw new Error('Invalid payload')
        }
        get match() { return this.matchData }
        get payload() { return this.payloadData }
        clone() {
            return new GeneratedReplaceClass(this.match, this.payload)
        }
        toJSON() {
            return { tag: 'Replace' as const, match: this.match.toJSON(), payload: this.payload.toJSON() }
        }
        get schema() {
            return [{
                data: { tag: 'Replace' as const },
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
                    { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
                ]
            }]
        }
        merge(incoming: StandardEditableWrapper<FinalType>) {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = addDelta(this.match.add, this.match.subtract, this.match.diff)({ remove: this.match.toJSON(), add: this.payload.toJSON() }, delta)
            if (remove) {
                if (add) {
                    return new GeneratedReplaceClass(remove as FinalType, add as FinalType)
                }
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        diff(incoming: StandardEditableWrapper<FinalType>) {
            let delta: StandardEditablePayloadDelta<PayloadDataType<FinalType>> = {}
            if (incoming instanceof GeneratedRemoveClass) {
                delta = { remove: incoming.match.toJSON() }
            }
            if (incoming instanceof GeneratedContentClass) {
                delta = { add: incoming.payload.toJSON() }
            }
            if (incoming instanceof GeneratedReplaceClass) {
                delta = { remove: incoming.match.toJSON(), add: incoming.payload.toJSON() }
            }
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = diffDelta(this.match.add, this.match.subtract, this.match.diff)({ remove: this.match.toJSON(), add: this.payload.toJSON() }, delta)
            if (remove) {
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        get plain() {
            return this.payload
        }
    }

    return {
        contentClass: GeneratedContentClass,
        removeClass: GeneratedRemoveClass,
        replaceClass: GeneratedReplaceClass,
        factory: (factoryProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string) => {
            //
            // First check whether the incoming argument to the factory is a StandardEditableData of the appropriate
            // data type. If it is, then we call the payloadFactory method on the discovered payload data and return the result.
            //
            const isRemove = (value: any): value is { tag: 'Remove'; match: PayloadDataType<FinalType> } => {
                return typeof value === 'object' && value !== null && value.tag === 'Remove' && props.typeguard(value.match)
            }
            const isReplace = (value: any): value is { tag: 'Replace'; match: PayloadDataType<FinalType>; payload: PayloadDataType<FinalType> } => {
                return typeof value === 'object' && value !== null && value.tag === 'Replace' && props.typeguard(value.match) && props.typeguard(value.payload)
            }
            if (props.typeguard(factoryProps)) {
                const payload = props.payloadFactory(factoryProps)
                if (payload) {
                    return new GeneratedContentClass(payload as FinalType)
                }
                return undefined
            }
            if ((Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) || typeof factoryProps === 'string') {
                const schema = typeof factoryProps === 'string' ? treeFromWML(factoryProps) : factoryProps
                const firstElement = schema[0]
                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    const payload = props.payloadFactory(firstElement.children)
                    if (payload) {
                        return new GeneratedRemoveClass(payload as FinalType)
                    }
                    return undefined
                }
                else if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    const matchPayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplaceMatch))
                    const payloadPayload = firstElement.children.find(treeNodeTypeguard(isSchemaReplacePayload))
                    if (matchPayload && payloadPayload) {
                        const match = props.payloadFactory(matchPayload.children)
                        const payload = props.payloadFactory(payloadPayload.children)
                        if (match && payload) {
                            return new GeneratedReplaceClass(match as FinalType, payload as FinalType)
                        }
                    }
                    return undefined
                }
                else {
                    const payload = props.payloadFactory(schema)
                    if (payload) {
                        return new GeneratedContentClass(payload as FinalType)
                    }
                    return undefined
                }
            }
            if (isRemove(factoryProps)) {
                const removePayload = factoryProps.match
                const payload = props.payloadFactory(removePayload)
                if (payload) {
                    return new GeneratedRemoveClass(payload as FinalType)
                }
                return undefined
            }
            if (isReplace(factoryProps)) {
                const matchPayload = factoryProps.match
                const payloadPayload = factoryProps.payload
                const match = props.payloadFactory(matchPayload)
                const payload = props.payloadFactory(payloadPayload)
                if (match && payload) {
                    return new GeneratedReplaceClass(match as FinalType, payload as FinalType)
                }
                return undefined
            }
            return undefined
        },
        typeguard: (x: any): x is PayloadDataType<FinalType> => {
            if (props.typeguard(x)) {
                return true
            }
            if (typeof x === 'object' && x !== null) {
                if (x.tag === 'Remove' && props.typeguard(x.match)) {
                    return true
                }
                if (x.tag === 'Replace' && props.typeguard(x.match) && props.typeguard(x.payload)) {
                    return true
                }
            }
            return false
        }        
    }
}
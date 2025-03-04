import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { deepEqual } from '../../lib/objects';

export interface StandardEditablePayload<DataType> {
    clone: () => StandardEditablePayload<DataType>;
    toJSON: () => DataType;
    schema: GenericTree<SchemaTag>;
    add: (base: DataType, incoming: DataType) => DataType;
    subtract: (base: DataType, incoming: DataType) => StandardEditableDataDelta<DataType>;
    diff: (incoming: StandardEditablePayload<DataType>) => StandardEditablePayload<DataType> | undefined;
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
    payloadFactory: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
    payload: new (props: DataType) => StandardEditablePayload<DataType>;
    // add: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
    // remove: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
}

export type StandardEditableFactoryReturn<FinalType extends StandardEditablePayload<any>> = {
    contentClass: new (data: PayloadDataType<FinalType> | FinalType) => StandardEditableWrapper<FinalType>;
    removeClass: new (match: PayloadDataType<FinalType> | FinalType) => StandardEditableWrapper<FinalType>;
    // replaceClass: new (match: DataType, payload: DataType) => StandardEditableWrapper<DataType, FinalType>;
    factory: (props: StandardEditableData<PayloadDataType<FinalType>>) => StandardEditableWrapper<FinalType> | undefined;
    typeguard: (x: any) => x is StandardEditableData<PayloadDataType<FinalType>>;
}

const addDelta = <FinalType extends StandardEditablePayload<any>>(
        add: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => PayloadDataType<FinalType>,
        subtract: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => StandardEditableDataDelta<PayloadDataType<FinalType>>
    ) => (
        base: StandardEditableDataDelta<PayloadDataType<FinalType>>,
        incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>
    ): StandardEditablePayloadDelta<PayloadDataType<FinalType>> => {
    const { add: baseAdd, remove: baseRemove } = base
    const { add: incomingAdd, remove: incomingRemove } = incoming
    if (baseRemove && incomingAdd) {
        const cancelledDelta = subtract(baseRemove, incomingAdd)
        return addDelta(add, subtract)(
            { add: baseAdd, remove: cancelledDelta.add },
            { add: cancelledDelta.remove, remove: incomingRemove }
        )
    }
    if (baseAdd && incomingRemove) {
        const cancelledDelta = subtract(baseAdd, incomingRemove)
        return addDelta(add, subtract)(
            { add: cancelledDelta.add, remove: baseRemove },
            { add: incomingAdd, remove: cancelledDelta.remove }
        )
    }
    if (baseRemove && incomingRemove) {
        return {
            add: baseAdd,
            remove: add(incomingRemove, baseRemove)
        }
    }
    if (baseAdd && incomingAdd) {
        return {
            add: add(baseAdd, incomingAdd),
            remove: baseRemove
        }
    }
    return {
        add: baseAdd ?? incomingAdd,
        remove: baseRemove ?? incomingRemove
    }
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
            else {
                if (payload instanceof props.payload) {
                    this.payload = payload
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
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = addDelta(this.payload.add, this.payload.subtract)({ add: this.payload.toJSON() }, delta)
            if (remove) {
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        diff(incoming: StandardEditableWrapper<FinalType>): StandardEditableWrapper<FinalType> | undefined {
            //
            // TODO: Add diff functionality to Remove class
            //
            if (!(incoming instanceof GeneratedContentClass)) {
                return undefined
            }
            const result = this.payload.diff(incoming.payload)
            if (result) {
                return new GeneratedContentClass(result as FinalType)
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
            if (deepEqual(delta, {})) {
                console.log(`merge finds no arguments`)
            }
            const { remove, add } = addDelta(this.match.add, this.match.subtract)({ remove: this.match.toJSON() }, delta)
            if (remove) {
                return new GeneratedRemoveClass(remove as FinalType)
            }
            else if (add) {
                return new GeneratedContentClass(add as FinalType)
            }
            return undefined
        }
        diff(incoming: StandardEditableWrapper<FinalType>) {
            if (!(incoming instanceof GeneratedRemoveClass)) {
                return undefined
            }
            if (incoming.match === this.match) {
                return undefined
            }
            return incoming
        }
        get plain() {
            return undefined
        }
    }

    return {
        contentClass: GeneratedContentClass,
        removeClass: GeneratedRemoveClass,
        factory: (factoryProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType) => {
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
            if (isRemove(factoryProps)) {
                const removePayload = factoryProps.match
                const payload = props.payloadFactory(removePayload)
                if (payload) {
                    return new GeneratedRemoveClass(payload as FinalType)
                }
                return undefined
            }
            if (isReplace(factoryProps)) {
                //
                // TODO: Add generated replace-class here
                //
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
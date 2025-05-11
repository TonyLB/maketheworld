import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from '@tonylb/mtw-base/ts/schema/edit';
import { isSchemaTreeNode, treeFromWML } from '../../schema';

export interface StandardEditablePayload<DataType> {
    clone: () => StandardEditablePayload<DataType>;
    toJSON: () => DataType;
    schema: GenericTree<SchemaTag>;
    // add: (base: DataType, incoming: DataType) => DataType;
    // subtract: (base: DataType, incoming: DataType, options?: { fromStart?: boolean }) => StandardEditableDataDelta<DataType>;
    // diff: (base: DataType, incoming: DataType) => StandardEditableDataDelta<DataType>;
}

export type StandardEditablePayloadDelta<DataType> = { remove?: StandardEditablePayload<DataType>; add?: StandardEditablePayload<DataType> }
export type StandardEditableDataDelta<DataType> = { remove?: DataType; add?: DataType }

type PayloadDataType<Payload extends StandardEditablePayload<any>> = Payload extends StandardEditablePayload<infer D> ? D : never;

export interface StandardEditableWrapper<PayloadType extends StandardEditablePayload<any>> {
    clone: () => StandardEditableWrapper<PayloadType>;
    toJSON: () => StandardEditableData<PayloadDataType<PayloadType>>;
    schema: GenericTree<SchemaTag>;
    nestedSchema: (tag: SchemaTag) => GenericTree<SchemaTag>;
    merge: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    diff: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    plain: PayloadType | undefined;
    _delta: StandardEditableDataDelta<PayloadDataType<PayloadType>>;
}

export type StandardEditableFactoryProps<DataType, FinalType extends StandardEditablePayload<DataType>> = {
    typeguard: (value: any) => value is DataType;
    payloadFactory: (props: DataType | GenericTree<SchemaTag>) => FinalType | undefined;
    payload: new (props: DataType) => FinalType;
    add: (base: DataType, incoming: DataType) => DataType;
    subtract: (base: DataType, incoming: DataType, options?: { fromStart?: boolean }) => StandardEditableDataDelta<DataType>;
    diff: (base: DataType, incoming: DataType) => StandardEditableDataDelta<DataType>;
}

export type StandardEditableFactoryReturn<FinalType extends StandardEditablePayload<any>> = {
    constructorDelta: (props: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string) => StandardEditableDataDelta<FinalType> | undefined;
    typeguard: (x: any) => x is StandardEditableData<PayloadDataType<FinalType>>;
    merge: (base: StandardEditableDataDelta<PayloadDataType<FinalType>>, incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>) => StandardEditableDataDelta<PayloadDataType<FinalType>>;
    diff: (base: StandardEditableDataDelta<PayloadDataType<FinalType>>, incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>) => StandardEditableDataDelta<PayloadDataType<FinalType>>;
}

const addDelta = <FinalType extends StandardEditablePayload<any>>(
        add: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>) => PayloadDataType<FinalType>,
        subtract: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>, options?: { fromStart?: boolean }) => StandardEditableDataDelta<PayloadDataType<FinalType>>,
        diff: (base: PayloadDataType<FinalType>, incoming: PayloadDataType<FinalType>, options?: { fromStart?: boolean }) => StandardEditableDataDelta<PayloadDataType<FinalType>>
    ) => (
        base: StandardEditableDataDelta<PayloadDataType<FinalType>>,
        incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>
    ): StandardEditableDataDelta<PayloadDataType<FinalType>> => {
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
): StandardEditableDataDelta<PayloadDataType<FinalType>> => {
    const { add: baseAdd, remove: baseRemove } = base
    return addDelta(add, subtract, diff)(
        { add: baseRemove, remove: baseAdd },
        incoming
    )
}        

export const standardEditableFactory = <FinalType extends StandardEditablePayload<any>>(props: StandardEditableFactoryProps<PayloadDataType<FinalType>, FinalType>): StandardEditableFactoryReturn<FinalType> => {
    return {
        constructorDelta: (constructorProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string) => {
            //
            // First, check whether the props are a string that needs to be parsed into a schema tree.
            //
            const factoryProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> = typeof constructorProps === 'string' ? treeFromWML(constructorProps) : constructorProps

            //
            // Next check whether the incoming argument to the factory is a StandardEditableData of the appropriate
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
                    return { add: payload }
                }
                return undefined
            }
            if ((Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) || typeof factoryProps === 'string') {
                const schema = typeof factoryProps === 'string' ? treeFromWML(factoryProps) : factoryProps
                const firstElement = schema[0]
                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    const payload = props.payloadFactory(firstElement.children)
                    if (payload) {
                        return { remove: payload }
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
                            return { remove: match, add: payload }
                        }
                    }
                    return undefined
                }
                else {
                    const payload = props.payloadFactory(schema)
                    if (payload) {
                        return { add: payload }
                    }
                    return undefined
                }
            }
            if (isRemove(factoryProps)) {
                const removePayload = factoryProps.match
                const payload = props.payloadFactory(removePayload)
                if (payload) {
                    return { remove: payload }
                }
                return undefined
            }
            if (isReplace(factoryProps)) {
                const matchPayload = factoryProps.match
                const payloadPayload = factoryProps.payload
                const match = props.payloadFactory(matchPayload)
                const payload = props.payloadFactory(payloadPayload)
                if (match && payload) {
                    return { remove: match, add: payload }
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
        },
        merge: (base: StandardEditableDataDelta<PayloadDataType<FinalType>>, incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>) => {
            return addDelta(props.add, props.subtract, props.diff)(base, incoming)
        },
        diff: (base: StandardEditableDataDelta<PayloadDataType<FinalType>>, incoming: StandardEditableDataDelta<PayloadDataType<FinalType>>) => {
            return diffDelta(props.add, props.subtract, props.diff)(base, incoming)
        }
    }
}
import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from '@tonylb/mtw-base/ts/schema/edit';
import { isSchemaTreeNode, treeFromWML } from '../../schema';
import { ReferenceFormat } from '../../standardize/components/utils/references';
import StandardReference from '../../standardize/keys/reference';

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

export type PayloadDataType<Payload extends StandardEditablePayload<any>> = Payload extends StandardEditablePayload<infer D> ? D : never;

export interface StandardEditableWrapper<PayloadType extends StandardEditablePayload<any>> {
    clone: () => StandardEditableWrapper<PayloadType>;
    toJSON: () => StandardEditableData<PayloadDataType<PayloadType>>;
    schema: GenericTree<SchemaTag>;
    nestedSchema: (tag: SchemaTag) => GenericTree<SchemaTag>;
    merge: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    diff: (incoming: StandardEditableWrapper<PayloadType>) => StandardEditableWrapper<PayloadType> | undefined;
    plain: PayloadType | undefined;
    _delta: StandardEditableDataDelta<PayloadDataType<PayloadType>>;
    // TODO: Add remapReferences method to interface when deprecating legacy standardEditableFactory
    // remapReferences: (props: { mapTo: ReferenceFormat, mappings: StandardKey[] }) => StandardEditableWrapper<PayloadType>;
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

export const addDelta = <FinalType extends StandardEditablePayload<any>>(
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
        
        // If baseAdd was completely cancelled (no remaining add) and we have an incomingAdd,
        // this means we're trying to replace baseAdd with incomingAdd. We need to validate
        // that they point to the same component (for references) or throw an error.
        if (!cancelledDelta.add && incomingAdd) {
            // Validate that incomingAdd points to the same component as baseAdd
            // This prevents Replace operations from changing target components
            add(baseAdd, incomingAdd)
        }
        
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

export const diffDelta = <FinalType extends StandardEditablePayload<any>>(
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
            // First check whether the props are a StandardEditableData of the appropriate data type. If it is, then we call the payloadFactory method on the discovered payload data and return the result.
            //
            if (props.typeguard(constructorProps)) {
                const payload = props.payloadFactory(constructorProps)
                if (payload) {
                    return { add: payload }
                }
                return undefined
            }
            //
            // Next, check whether the props are a string that needs to be parsed into a schema tree.
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
                if (schema.length === 0) {
                    return undefined
                }
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

// v2StandardEditableFactory - Creates abstract parent class with concrete subtype instances
export const v2StandardEditableFactory = <DataType, FinalType extends StandardEditablePayload<DataType>>(
    props: StandardEditableFactoryProps<DataType, FinalType>, 
    className: string
) => {
    // Create a comprehensive dataTypeguard that handles edit-wrapped data
    const dataTypeguard = (value: any): value is StandardEditableData<DataType> => {
        // Handle plain data using the base typeguard
        if (props.typeguard(value)) {
            return true
        }
        
        // Handle Remove structure
        if (typeof value === 'object' && value !== null && value.tag === 'Remove' && 'match' in value) {
            return props.typeguard(value.match)
        }
        
        // Handle Replace structure  
        if (typeof value === 'object' && value !== null && value.tag === 'Replace' && 'match' in value && 'payload' in value) {
            return props.typeguard(value.match) && props.typeguard(value.payload)
        }
        
        return false
    }
    // Shared default implementation for _wrap method
    const defaultWrap = <T extends GeneratedV2EditableClass>(instance: GeneratedV2EditableClass): T => {
        return instance as T;
    }
    // Concrete parent class with stub implementations (to allow InstanceType to work)
    class GeneratedV2EditableClass implements StandardEditableWrapper<FinalType> {
        constructor() {}
        
        // Stub getter that must be implemented by concrete types
        get _delta(): StandardEditableDataDelta<PayloadDataType<FinalType>> {
            throw new Error('_delta getter must be implemented by concrete subclass');
        }
        
        // Stub method that must be implemented by concrete types
        toJSON(): StandardEditableData<PayloadDataType<FinalType>> {
            throw new Error('toJSON() must be implemented by concrete subclass');
        }
        
        // Stub getter that must be implemented by concrete types
        get schema(): GenericTree<SchemaTag> {
            throw new Error('schema getter must be implemented by concrete subclass');
        }
        
        // Stub method that must be implemented by concrete types
        clone(): GeneratedV2EditableClass {
            throw new Error('clone() must be implemented by concrete subclass');
        }
        
        // Stub getter that must be implemented by concrete types
        get plain(): FinalType | undefined {
            throw new Error('plain getter must be implemented by concrete subclass');
        }
        
        // Stub method that must be implemented by concrete types
        remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardReference[] }): GeneratedV2EditableClass {
            throw new Error('remapReferences() must be implemented by concrete subclass');
        }
        
        // _wrap method for type-safe wrapping (can be overridden by inheriting classes)
        _wrap(instance: GeneratedV2EditableClass): GeneratedV2EditableClass {
            return instance;
        }
        
        // Invert method implemented in abstract class using delta
        invert(): GeneratedV2EditableClass {
            const delta = this._delta;
            // Swap add and remove: inversion of {add: X} is {remove: X}, inversion of {remove: Y} is {add: Y}
            const invertedDelta: StandardEditableDataDelta<PayloadDataType<FinalType>> = {
                add: delta.remove,
                remove: delta.add
            };
            const inverted = GeneratedV2EditableClass.fromDelta(invertedDelta);
            // fromDelta can return undefined for empty deltas, but inversion of empty should also be empty/undefined
            // However, we should never have an empty delta in practice - all instances should have either add or remove
            if (!inverted) {
                throw new Error('Inversion produced undefined result - this should not happen with valid edit operations');
            }
            return this._wrap(inverted);
        }
        
        // Nested schema method that returns the schema (same as schema getter for compatibility)
        nestedSchema(tag: SchemaTag): GenericTree<SchemaTag> {
            return this.schema;
        }
        
        // Merge method that operates on deltas
        merge(other: StandardEditableWrapper<FinalType>): GeneratedV2EditableClass | undefined {
            const baseDelta = this._delta;
            const incomingDelta = (other as any)._delta;
            const mergedDelta = addDelta(props.add, props.subtract, props.diff)(baseDelta, incomingDelta);
            const result = GeneratedV2EditableClass.fromDelta(mergedDelta);
            return result ? this._wrap(result) : undefined;
        }

        // Diff method that operates on deltas
        diff(other: StandardEditableWrapper<FinalType>): GeneratedV2EditableClass | undefined {
            const baseDelta = this._delta;
            const incomingDelta = (other as any)._delta;
            const resultDelta = diffDelta(props.add, props.subtract, props.diff)(baseDelta, incomingDelta);
            const result = GeneratedV2EditableClass.fromDelta(resultDelta);
            return result ? this._wrap(result) : undefined;
        }
        
        // Factory method that creates instances from delta objects
        static fromDelta(delta: StandardEditableDataDelta<PayloadDataType<FinalType>>): GeneratedV2EditableClass | undefined {
            const { add, remove } = delta;
            
            if (add && remove) {
                // Both add and remove present = Replace
                const replaceData = { tag: 'Replace' as const, match: remove, payload: add };
                return new GeneratedV2EditableReplaceClass(replaceData);
            } else if (remove) {
                // Only remove present = Remove
                const removeData = { tag: 'Remove' as const, match: remove };
                return new GeneratedV2EditableRemoveClass(removeData);
            } else if (add) {
                // Only add present = Plain
                return new GeneratedV2EditablePlainClass(add);
            } else {
                // Empty delta - represents no content (completely removed content)
                return undefined;
            }
        }
        
        // Factory method that decides which subtype to return
        static create(constructorProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string): GeneratedV2EditableClass {
            // First check if it's a StandardEditableData of the appropriate type
            if (props.typeguard(constructorProps)) {
                return new GeneratedV2EditablePlainClass(constructorProps)
            }
            
            // Handle string by parsing to schema tree
            const factoryProps: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> = typeof constructorProps === 'string' ? treeFromWML(constructorProps) : constructorProps
            
            // Check if it's a StandardEditableData after parsing
            if (props.typeguard(factoryProps)) {
                return new GeneratedV2EditablePlainClass(factoryProps)
            }
            
            // Handle schema tree parsing for Remove/Replace tags
            if ((Array.isArray(factoryProps) && factoryProps.every(isSchemaTreeNode)) || typeof factoryProps === 'string') {
                const schema = typeof factoryProps === 'string' ? treeFromWML(factoryProps) : factoryProps
                if (schema.length === 0) {
                    return new GeneratedV2EditablePlainClass(schema)
                }
                
                const firstElement = schema[0]
                if (treeNodeTypeguard(isSchemaRemove)(firstElement)) {
                    return new GeneratedV2EditableRemoveClass(schema)
                }
                else if (treeNodeTypeguard(isSchemaReplace)(firstElement)) {
                    return new GeneratedV2EditableReplaceClass(schema)
                }
                else {
                    return new GeneratedV2EditablePlainClass(schema)
                }
            }
            
            // Handle Remove/Replace objects
            if (typeof factoryProps === 'object' && factoryProps !== null && 'tag' in factoryProps) {
                if (factoryProps.tag === 'Remove' && 'match' in factoryProps && props.typeguard(factoryProps.match)) {
                    return new GeneratedV2EditableRemoveClass(factoryProps)
                }
                if (factoryProps.tag === 'Replace' && 'match' in factoryProps && 'payload' in factoryProps && props.typeguard(factoryProps.match) && props.typeguard(factoryProps.payload)) {
                    return new GeneratedV2EditableReplaceClass(factoryProps)
                }
            }
            
            // Default to plain
            return new GeneratedV2EditablePlainClass(factoryProps)
        }
    }
    
    // Concrete Plain subtype - stores the payload directly
    class GeneratedV2EditablePlainClass extends GeneratedV2EditableClass {
        public readonly payload: FinalType | undefined
        
        constructor(data: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag>) {
            super()
            // Parse and store the payload
            if (data instanceof props.payload) {
                // If it's already a payload instance, use it directly
                this.payload = data
            } else if (props.typeguard(data)) {
                // If it's the right data type, create a payload from it
                this.payload = props.payloadFactory(data)
            } else {
                // Parse the data and create a payload
                const delta = props.payloadFactory(data as GenericTree<SchemaTag>)
                if (delta) {
                    this.payload = delta
                }
            }
        }
        
        override get _delta(): StandardEditableDataDelta<PayloadDataType<FinalType>> {
            return { add: this.payload?.toJSON() as PayloadDataType<FinalType> }
        }
        
        override toJSON(): StandardEditableData<PayloadDataType<FinalType>> {
            return this.payload?.toJSON() as PayloadDataType<FinalType>;
        }
        
        override get schema(): GenericTree<SchemaTag> {
            return this.payload?.schema ?? [];
        }
        
        override clone(): GeneratedV2EditableClass {
            const result = this.payload 
                ? new GeneratedV2EditablePlainClass(this.payload)
                : new GeneratedV2EditablePlainClass([] as GenericTree<SchemaTag>);
            return this._wrap(result);
        }
        
        override get plain(): FinalType | undefined {
            return this.payload;
        }
        
        override remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardReference[] }): GeneratedV2EditableClass {
            if (this.payload && 'remapReferences' in this.payload) {
                const remappedPayload = (this.payload as any).remapReferences(props);
                const result = new GeneratedV2EditablePlainClass(remappedPayload);
                return this._wrap(result);
            }
            return this.clone();
        }
        
        override _wrap(instance: GeneratedV2EditableClass): GeneratedV2EditableClass {
            return defaultWrap(instance);
        }
    }
    
    // Concrete Remove subtype - stores the match payload
    class GeneratedV2EditableRemoveClass extends GeneratedV2EditableClass {
        public readonly match: FinalType | undefined
        
        constructor(data: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string) {
            super()
            // Parse and store the match payload
            if (data instanceof props.payload) {
                // If it's already a payload instance, use it directly
                this.match = data
            } else if (props.typeguard(data)) {
                // If it's the right data type, create a payload from it
                this.match = props.payloadFactory(data)
            } else if (typeof data === 'object' && data !== null && 'tag' in data && data.tag === 'Remove' && 'match' in data) {
                // Handle Remove object structure - extract the match data
                const removeData = data as { tag: 'Remove'; match: PayloadDataType<FinalType> }
                if (props.typeguard(removeData.match)) {
                    this.match = props.payloadFactory(removeData.match)
                }
            } else if (Array.isArray(data) && data.length > 0 && data[0].data.tag === 'Remove') {
                // Handle Remove schema tree - extract the children data
                const removeSchema = data[0] as { data: { tag: 'Remove' }; children: GenericTree<SchemaTag> }
                this.match = props.payloadFactory(removeSchema.children)
            } else {
                // Parse the data and create a payload
                const delta = props.payloadFactory(data as GenericTree<SchemaTag>)
                if (delta) {
                    this.match = delta
                }
            }
        }
        
        override get _delta(): StandardEditableDataDelta<PayloadDataType<FinalType>> {
            return { remove: this.match?.toJSON() as PayloadDataType<FinalType> }
        }
        
        override toJSON(): StandardEditableData<PayloadDataType<FinalType>> {
            return { tag: 'Remove' as const, match: this.match?.toJSON() as PayloadDataType<FinalType> };
        }
        
        override get schema(): GenericTree<SchemaTag> {
            if (!this.match) return [];
            return [{ 
                data: { tag: 'Remove' as const }, 
                children: this.match.schema 
            }];
        }
        
        override clone(): GeneratedV2EditableClass {
            const result = this.match
                ? new GeneratedV2EditableRemoveClass(this.match)
                : new GeneratedV2EditableRemoveClass([] as GenericTree<SchemaTag>);
            return this._wrap(result);
        }
        
        override get plain(): FinalType | undefined {
            return this.match;
        }
        
        override remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardReference[] }): GeneratedV2EditableClass {
            if (this.match && 'remapReferences' in this.match) {
                const remappedMatch = (this.match as any).remapReferences(props);
                const result = new GeneratedV2EditableRemoveClass(remappedMatch);
                return this._wrap(result);
            }
            return this.clone();
        }
        
        override _wrap(instance: GeneratedV2EditableClass): GeneratedV2EditableClass {
            return defaultWrap(instance);
        }
    }
    
    // Concrete Replace subtype - stores both match and payload
    class GeneratedV2EditableReplaceClass extends GeneratedV2EditableClass {
        public readonly match: FinalType | undefined
        public readonly payload: FinalType | undefined
        
        constructor(data: StandardEditableData<PayloadDataType<FinalType>> | FinalType | GenericTree<SchemaTag> | string) {
            super()
            // Parse and store both match and payload
            if (data instanceof props.payload) {
                // If it's already a payload instance, use it directly
                this.payload = data
            } else if (props.typeguard(data)) {
                // For Replace, we need both match and payload, but we only have one data source
                // This is a limitation - we'd need more context to properly split this
                // For now, store as payload and let the user handle the split
                this.payload = props.payloadFactory(data)
            } else if (typeof data === 'object' && data !== null && 'tag' in data && data.tag === 'Replace' && 'match' in data && 'payload' in data) {
                // Handle Replace object structure - extract the match and payload data
                const replaceData = data as { tag: 'Replace'; match: PayloadDataType<FinalType>; payload: PayloadDataType<FinalType> }
                if (props.typeguard(replaceData.match) && props.typeguard(replaceData.payload)) {
                    this.match = props.payloadFactory(replaceData.match)
                    this.payload = props.payloadFactory(replaceData.payload)
                }
            } else if (Array.isArray(data) && data.length > 0 && data[0].data.tag === 'Replace') {
                // Handle Replace schema tree - extract the ReplaceMatch and ReplacePayload data
                const replaceSchema = data[0] as { data: { tag: 'Replace' }; children: GenericTree<SchemaTag> }
                const matchNode = replaceSchema.children.find(child => child.data.tag === 'ReplaceMatch')
                const payloadNode = replaceSchema.children.find(child => child.data.tag === 'ReplacePayload')
                
                if (matchNode && payloadNode) {
                    this.match = props.payloadFactory(matchNode.children)
                    this.payload = props.payloadFactory(payloadNode.children)
                }
            } else {
                // Parse the data and create a payload
                const delta = props.payloadFactory(data as GenericTree<SchemaTag>)
                if (delta) {
                    // Similar limitation - we'd need to parse the Replace structure properly
                    this.payload = delta
                }
            }
        }
        
        override get _delta(): StandardEditableDataDelta<PayloadDataType<FinalType>> {
            return { remove: this.match?.toJSON() as PayloadDataType<FinalType>, add: this.payload?.toJSON() as PayloadDataType<FinalType> }
        }
        
        override toJSON(): StandardEditableData<PayloadDataType<FinalType>> {
            return { 
                tag: 'Replace' as const, 
                match: this.match?.toJSON() as PayloadDataType<FinalType>, 
                payload: this.payload?.toJSON() as PayloadDataType<FinalType> 
            };
        }
        
        override get schema(): GenericTree<SchemaTag> {
            if (!this.match || !this.payload) return [];
            return [{ 
                data: { tag: 'Replace' as const }, 
                children: [
                    { data: { tag: 'ReplaceMatch' as const }, children: this.match.schema },
                    { data: { tag: 'ReplacePayload' as const }, children: this.payload.schema }
                ]
            }];
        }
        
        override clone(): GeneratedV2EditableClass {
            if (this.match && this.payload) {
                const replaceData = {
                    tag: 'Replace' as const,
                    match: this.match.toJSON() as PayloadDataType<FinalType>,
                    payload: this.payload.toJSON() as PayloadDataType<FinalType>
                };
                const result = new GeneratedV2EditableReplaceClass(replaceData);
                return this._wrap(result);
            } else {
                const result = new GeneratedV2EditableReplaceClass([] as GenericTree<SchemaTag>);
                return this._wrap(result);
            }
        }
        
        override get plain(): FinalType | undefined {
            return this.payload;
        }
        
        override remapReferences(props: { mapTo: ReferenceFormat, mappings: StandardReference[] }): GeneratedV2EditableClass {
            let remappedMatch = this.match;
            let remappedPayload = this.payload;
            
            if (this.match && 'remapReferences' in this.match) {
                remappedMatch = (this.match as any).remapReferences(props);
            }
            if (this.payload && 'remapReferences' in this.payload) {
                remappedPayload = (this.payload as any).remapReferences(props);
            }
            
            if (remappedMatch !== this.match || remappedPayload !== this.payload) {
                const replaceData = { 
                    tag: 'Replace' as const, 
                    match: remappedMatch?.toJSON() as PayloadDataType<FinalType>, 
                    payload: remappedPayload?.toJSON() as PayloadDataType<FinalType> 
                };
                const result = new GeneratedV2EditableReplaceClass(replaceData);
                return this._wrap(result);
            }
            
            return this.clone();
        }
        
        override _wrap(instance: GeneratedV2EditableClass): GeneratedV2EditableClass {
            return defaultWrap(instance);
        }
    }
    
    return {
        EditableClass: GeneratedV2EditableClass,
        PlainClass: GeneratedV2EditablePlainClass,
        RemoveClass: GeneratedV2EditableRemoveClass,
        ReplaceClass: GeneratedV2EditableReplaceClass,
        dataTypeguard
    }
}
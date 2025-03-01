import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';

export interface StandardEditablePayload<DataType> {
    clone: () => StandardEditablePayload<DataType>;
    toJSON: () => DataType;
    schema: GenericTree<SchemaTag>;
    merge: (incoming: StandardEditablePayload<DataType>) => StandardEditablePayload<DataType> | undefined;
    diff: (incoming: StandardEditablePayload<DataType>) => StandardEditablePayload<DataType> | undefined;
    data: DataType;
}

export interface StandardEditableWrapper<DataType, PayloadType extends StandardEditablePayload<DataType>> {
    clone: () => StandardEditableWrapper<DataType, PayloadType>;
    toJSON: () => StandardEditableData<DataType>;
    schema: GenericTree<SchemaTag>;
    merge: (incoming: StandardEditableWrapper<DataType, PayloadType>) => StandardEditableWrapper<DataType, PayloadType> | undefined;
    diff: (incoming: StandardEditableWrapper<DataType, PayloadType>) => StandardEditableWrapper<DataType, PayloadType> | undefined;
    plain: PayloadType;
}

export type StandardEditableFactoryProps<DataType> = {
    typeguard: (value: any) => value is DataType;
    payloadFactory: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
    // add: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
    // remove: (props: StandardEditableData<DataType>) => StandardEditablePayload<DataType> | undefined;
}

export type StandardEditableFactoryReturn<DataType, FinalType extends StandardEditablePayload<DataType>> = {
    contentClass: new (data: DataType | StandardEditablePayload<DataType>) => StandardEditableWrapper<DataType, FinalType>;
    removeClass: new (match: DataType) => StandardEditableWrapper<DataType, FinalType>;
    // replaceClass: new (match: DataType, payload: DataType) => StandardEditableWrapper<DataType, FinalType>;
    factory: (props: StandardEditableData<DataType>) => StandardEditableWrapper<DataType, FinalType> | undefined;
    typeguard: (x: any) => x is StandardEditableData<DataType>;
}

export const standardEditableFactory = <DataType, FinalType extends StandardEditablePayload<DataType>>(props: StandardEditableFactoryProps<DataType>): StandardEditableFactoryReturn<DataType, FinalType> => {
    class StandardEditableClassAbstract implements StandardEditableWrapper<DataType, FinalType> {
        constructor() {}
        clone(): StandardEditableWrapper<DataType, FinalType> {
            throw new Error('Method not implemented.')
        }
        toJSON(): StandardEditableData<DataType> {
            throw new Error('Method not implemented.')
        }
        get schema(): GenericTree<SchemaTag> { return [] }
        merge(incoming: StandardEditableWrapper<DataType, FinalType>): StandardEditableWrapper<DataType, FinalType> | undefined {
            throw new Error('Method not implemented.')
        }
        diff(incoming: StandardEditableWrapper<DataType, FinalType>): StandardEditableWrapper<DataType, FinalType> | undefined {
            throw new Error('Method not implemented.')
        }
        get plain(): FinalType {
            throw new Error('Method not implemented.')
        }
    }

    //
    // Make abstract classes for all three types, so that we can use them to discriminate the incoming
    // class types inside class methods without creating circular dependencies.
    //
    class ContentClassAbstract extends StandardEditableClassAbstract {}
    class RemoveClassAbstract extends StandardEditableClassAbstract {}
    class ReplaceClassAbstract extends StandardEditableClassAbstract {}

    class GeneratedContentClass extends ContentClassAbstract {
        payload: FinalType;
        constructor(payload: DataType | StandardEditablePayload<DataType>) {
            super()
            if (props.typeguard(payload)) {
                const result = props.payloadFactory(payload)
                if (result) {
                    this.payload = result as FinalType
                    return
                }
            }
            else {
                if (payload instanceof Object && 'clone' in payload && 'toJSON' in payload && 'schema' in payload && 'merge' in payload && 'diff' in payload) {
                    this.payload = payload as FinalType
                    return
                }
            }
            throw new Error('Invalid payload')
        }
        override clone() {
            const result = this.payload.toJSON()
            if (props.typeguard(result)) {
                return new GeneratedContentClass(result)
            }
            throw new Error('Invalid payload')
        }
        override toJSON() {
            return this.payload.toJSON()
        }
        override get schema() {
            return this.payload.schema
        }
        override merge(incoming: StandardEditableWrapper<DataType, FinalType>) {
            //
            // TODO: Add merge functionality to Remove class
            //
            if (!(incoming instanceof GeneratedContentClass)) {
                return undefined
            }
            const result = this.payload.merge(incoming.payload)
            if (result) {
                return new GeneratedContentClass(result)
            }
            return undefined
        }
        override diff(incoming: StandardEditableWrapper<DataType, FinalType>): StandardEditableWrapper<DataType, FinalType> | undefined {
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
        override get plain() {
            return this.payload
        }
    }

    class GeneratedRemoveClass extends RemoveClassAbstract {
        match: FinalType;
        constructor(payload: DataType | StandardEditablePayload<DataType>) {
            super()
            if (props.typeguard(payload)) {
                const result = props.payloadFactory(payload)
                if (result) {
                    this.match = result as FinalType
                    return
                }
            }
            else {
                if (payload instanceof Object && 'clone' in payload && 'toJSON' in payload && 'schema' in payload && 'merge' in payload && 'diff' in payload) {
                    this.match = payload as FinalType
                    return
                }
            }
            throw new Error('Invalid payload')
        }
        override clone() {
            return new GeneratedRemoveClass(this.match)
        }
        override toJSON() {
            return { tag: 'Remove' as const, match: this.match.toJSON() }
        }
        override get schema() {
            return [{
                data: { tag: 'Remove' as const },
                children: this.match.schema
            }]
        }
        override merge(incoming: StandardEditableWrapper<DataType, FinalType>) {
            if (!(incoming instanceof GeneratedRemoveClass)) {
                return undefined
            }
            if (incoming.match === this.match) {
                return undefined
            }
            return incoming
        }
        override diff(incoming: StandardEditableWrapper<DataType, FinalType>) {
            if (!(incoming instanceof GeneratedRemoveClass)) {
                return undefined
            }
            if (incoming.match === this.match) {
                return undefined
            }
            return incoming
        }
    }
    return {
        contentClass: GeneratedContentClass,
        removeClass: GeneratedRemoveClass,
        factory: (factoryProps: StandardEditableData<DataType> | StandardEditablePayload<DataType>) => {
            //
            // First check whether the incoming argument to the factory is a StandardEditableData of the appropriate
            // data type. If it is, then we call the payloadFactory method on the discovered payload data and return the result.
            //
            const isRemove = (value: any): value is { tag: 'Remove'; match: DataType } => {
                return typeof value === 'object' && value !== null && value.tag === 'Remove' && props.typeguard(value.match)
            }
            const isReplace = (value: any): value is { tag: 'Replace'; match: DataType; payload: DataType } => {
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
        typeguard: (x: any): x is StandardEditableData<DataType> => {
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
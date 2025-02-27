import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';

export interface StandardEditable<DataType> {
    clone: () => StandardEditable<DataType>;
    toJSON: () => StandardEditableData<DataType>;
    schema: GenericTree<SchemaTag>;
    merge: (incoming: StandardEditable<DataType>) => StandardEditable<DataType> | undefined;
    diff: (incoming: StandardEditable<DataType>) => StandardEditable<DataType> | undefined;
}

export interface StandardEditableWrapper<DataType> extends StandardEditable<DataType> {
    plain: StandardEditable<DataType>;
}

export type StandardEditableFactoryProps<DataType, FinalType extends StandardEditable<DataType>> = {
    typeguard: (value: any) => value is DataType;
    payloadFactory: (props: StandardEditableData<DataType>) => FinalType | undefined;
}

export type StandardEditableFactoryReturn<DataType, FinalType> = {
    factory: (props: StandardEditableData<DataType>) => StandardEditable<FinalType> | undefined;
    typeguard: (x: any) => x is StandardEditableData<DataType>;
}

export const standardEditableFactory = <DataType, FinalType extends StandardEditable<DataType>>(props: StandardEditableFactoryProps<DataType, FinalType>): StandardEditableFactoryReturn<DataType, FinalType> => {
    return {
        factory: (factoryProps: StandardEditableData<DataType>) => {
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
                return props.payloadFactory(factoryProps) as StandardEditable<FinalType> | undefined
            }
            if (isRemove(factoryProps)) {
                //
                // TODO: Add generated remove-class here
                //
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
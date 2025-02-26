import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'

export type StandardEditableFactoryProps<T> = {
    typeguard: (x: any) => x is T;
}

export interface StandardEditable<T> {
}

export type StandardEditableFactoryReturn<T> = {
    factory: () => StandardEditable<T> | undefined;
    typeguard: (x: any) => x is StandardEditableData<T>;
}

export const standardEditableFactory = <T>(props: StandardEditableFactoryProps<T>): StandardEditableFactoryReturn<T> => {
    return {
        factory: () => undefined,
        typeguard: (x: any): x is StandardEditableData<T> => {
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
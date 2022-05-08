import { ComponentAppearance } from '../../wml/normalize'

type InheritedDataTypes = 'Component' | 'Map' | 'Exit'

export type InheritedExit = {
    type: 'Exit';
    to: string;
    from: string;
    name: string;
}

export type InheritedItem = InheritedExit

export const isInheritedExit = (arg: InheritedItem): arg is InheritedExit => (arg.type === 'Exit')

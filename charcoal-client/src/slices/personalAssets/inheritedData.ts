import { ComponentAppearance, ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

type InheritedDataTypes = 'Component' | 'Map' | 'Exit'

export type InheritedExit = {
    type: 'Exit';
    to: string;
    from: string;
    name: string;
}

export type InheritedComponent = {
    type: 'Component';
    name?: string;
    render?: ComponentRenderItem[];
}

export type InheritedMapLayerRoom = {
    x: number;
    y: number;
    name?: string;
}

export type InheritedMapLayer = {
    tag: 'Map';
    exits?: Omit<InheritedExit, 'type'>;
    rooms?: Record<string, InheritedMapLayerRoom>;
}

export type InheritedMap = {
    type: 'Map';
    layers?: InheritedMapLayer[];
}

export type InheritedItem = InheritedExit | InheritedComponent | InheritedMap

export const isInheritedExit = (arg: InheritedItem): arg is InheritedExit => (arg.type === 'Exit')
export const isInheritedComponent = (arg: InheritedItem): arg is InheritedComponent => (arg.type === 'Component')
export const isInheritedMap = (arg: InheritedItem): arg is InheritedMap => (arg.type === 'Map')

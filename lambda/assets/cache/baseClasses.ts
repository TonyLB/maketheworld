import { ComponentRenderItem } from "@tonylb/mtw-wml/dist/normalize"

export type EphemeraCondition = {
    dependencies: string[];
    if: string;
}

export type EphemeraFeatureAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
}

export type EphemeraFeature = {
    EphemeraId: string;
    key: string;
    tag: 'Feature';
    appearances: EphemeraFeatureAppearance[];
}

export type EphemeraExit = {
    name: string;
    to: string;
}

export type EphemeraRoomAppearance = {
    conditions: EphemeraCondition[];
    name: string;
    render: ComponentRenderItem[];
    exits: EphemeraExit[];
}

export type EphemeraRoom = {
    EphemeraId: string;
    key: string;
    tag: 'Room';
    appearances: EphemeraRoomAppearance[];
}

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
}

export type EphemeraMapAppearance = {
    conditions: EphemeraCondition[];
    fileURL: string;
    name: string;
    rooms: Record<string, EphemeraMapRoom>;
}

export type EphemeraMap = {
    EphemeraId: string;
    key: string;
    tag: 'Map';
    appearances: EphemeraMapAppearance[];
}

//
// TODO (ISS1385): Add EphemeraAction to base classes
//

export type EphemeraItem = EphemeraFeature | EphemeraRoom | EphemeraMap

export type EphemeraDependencies = {
    room?: string[];
    map?: string[];
    mapCache?: string;
}

export type EphemeraStateComputed = {
    key: string;
    computed: true;
    src: string;
}

export type EphemeraStateVariable = {
    key: string;
    computed: false;
    value: any;
}

type EphemeraStateItem = EphemeraStateComputed | EphemeraStateVariable

export type EphemeraState = {
    [key: string]: EphemeraStateItem
}

export const isEphemeraStateVariable = (item: EphemeraStateItem): item is EphemeraStateVariable => (!item.computed)
export const isEphemeraStateComputed = (item: EphemeraStateItem): item is EphemeraStateComputed => (item.computed)

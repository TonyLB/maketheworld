import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'
import { ComponentExamplesPayload } from './exampleEnrichment'

export type ExampleLifecycleBase = {
    exampleId: ComponentUUID;
    parentIds: ComponentUUID[];
    assetStack: AssetUUID[];
    perspectiveMatcher: PerspectiveMatcher;
}

export type ExampleAdded = ExampleLifecycleBase & {
    type: 'ExampleAdded';
    example: ComponentExamplesPayload;
}

export type ExampleUpdated = ExampleLifecycleBase & {
    type: 'ExampleUpdated';
    example: ComponentExamplesPayload;
}

export type ExampleRemoved = ExampleLifecycleBase & {
    type: 'ExampleRemoved';
}

export type ComponentExamplesEventUpdate =
    | ExampleAdded
    | ExampleUpdated
    | ExampleRemoved


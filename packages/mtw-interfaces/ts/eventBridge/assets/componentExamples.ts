import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { PerspectiveMatcher } from '../../perspective'

//
// Shared event contracts for the mtw.assets.componentExamples data source.
//
// These mirror the payloads emitted from lambda/assets/componentExamples,
// but live in the interfaces package so Ephemera and other consumers can
// depend on a stable shape without importing lambda code.
//
// During migration: exampleId may be an Example uuid (EXAMPLE#...) or a Situation uuid
// (SITUATION#...). parentIds lists Room / Feature / Knowledge facet parents for
// situation-keyed events; standalone Example enrichment does not populate parentIds.
// The payload shape (marks + render + provenance) is the same for both id types.
//

export type ComponentExamplesMarkValue = {
    mark: string;
    value: string;
}

export type ComponentExamplesMarkState = {
    markValue: ComponentExamplesMarkValue[];
}

export type ComponentExamplesRenderedContent = {
    displayName?: RenderTree;
    summary?: RenderTree;
    description: RenderTree;
}

export type ComponentExamplesProvenance = {
    type: 'authored';
}

export type ComponentExamplesPayload = {
    markState: ComponentExamplesMarkState;
    renderedContent: ComponentExamplesRenderedContent;
    provenance: ComponentExamplesProvenance;
}

export type ComponentExamplesLifecycleBase = {
    exampleId: ComponentUUID;
    parentIds: ComponentUUID[];
    assetStack: AssetUUID[];
    perspectiveMatcher: PerspectiveMatcher;
}

export type ComponentExamplesAddedEvent = ComponentExamplesLifecycleBase & {
    type: 'ExampleAdded';
    example: ComponentExamplesPayload;
}

export type ComponentExamplesUpdatedEvent = ComponentExamplesLifecycleBase & {
    type: 'ExampleUpdated';
    example: ComponentExamplesPayload;
}

export type ComponentExamplesRemovedEvent = ComponentExamplesLifecycleBase & {
    type: 'ExampleRemoved';
}

//
// Discriminated union covering all Example lifecycle events published on
// the mtw.assets.componentExamples stream. This is the primary contract
// Ephemera Phase 2b consumes for cache mirroring.
//
export type ComponentExamplesMirrorEvent =
    | ComponentExamplesAddedEvent
    | ComponentExamplesUpdatedEvent
    | ComponentExamplesRemovedEvent


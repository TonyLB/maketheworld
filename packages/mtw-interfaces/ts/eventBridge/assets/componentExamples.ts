import { AssetUUID, ComponentUUID, isSchemaAssetUUID, isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isEphemeraSituationId } from '../../baseClasses'
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

//
// Invalidation events (no example body). Component-scoped vs Situation-scoped are
// mutually exclusive shapes distinguished by field presence, not a separate type string.
//

export type ComponentScopedExampleInvalidatedEvent = {
    type: 'ExampleInvalidated';
    componentIds: ComponentUUID[];
    editAssetId: AssetUUID;
    /** Debug/logging only (P1). */
    affectedSituationIds?: ComponentUUID[];
}

export type SituationScopedExampleInvalidatedEvent = {
    type: 'ExampleInvalidated';
    situationId: ComponentUUID;
    editAssetId: AssetUUID;
    /** When true (Situation Component Removed), bump all adjacency links and delete the partition (P5). */
    entityRemoved?: true;
}

export type ComponentExamplesInvalidatedEvent =
    | ComponentScopedExampleInvalidatedEvent
    | SituationScopedExampleInvalidatedEvent

export type ComponentExamplesEvent =
    | ComponentExamplesMirrorEvent
    | ComponentExamplesInvalidatedEvent

const hasMirrorOnlyFields = (event: Record<string, unknown>): boolean => (
    'example' in event
    || 'exampleId' in event
    || 'parentIds' in event
    || 'assetStack' in event
    || 'perspectiveMatcher' in event
    || 'editAssetStack' in event
)

const isValidComponentUuidList = (value: unknown): value is ComponentUUID[] => (
    Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === 'string' && isSchemaComponentUUID(entry))
)

const isValidOptionalComponentUuidList = (value: unknown): value is ComponentUUID[] | undefined => (
    value === undefined
    || (
        Array.isArray(value)
        && value.every((entry) => typeof entry === 'string' && isSchemaComponentUUID(entry))
    )
)

export const isComponentScopedExampleInvalidated = (
    event: unknown
): event is ComponentScopedExampleInvalidatedEvent => {
    if (!event || typeof event !== 'object') {
        return false
    }
    const record = event as Record<string, unknown>
    if (record.type !== 'ExampleInvalidated') {
        return false
    }
    if ('situationId' in record) {
        return false
    }
    if (!isValidComponentUuidList(record.componentIds)) {
        return false
    }
    if (typeof record.editAssetId !== 'string' || !isSchemaAssetUUID(record.editAssetId)) {
        return false
    }
    if (!isValidOptionalComponentUuidList(record.affectedSituationIds)) {
        return false
    }
    return !hasMirrorOnlyFields(record)
}

export const isSituationScopedExampleInvalidated = (
    event: unknown
): event is SituationScopedExampleInvalidatedEvent => {
    if (!event || typeof event !== 'object') {
        return false
    }
    const record = event as Record<string, unknown>
    if (record.type !== 'ExampleInvalidated') {
        return false
    }
    if ('componentIds' in record) {
        return false
    }
    if (typeof record.situationId !== 'string' || !isEphemeraSituationId(record.situationId)) {
        return false
    }
    if (typeof record.editAssetId !== 'string' || !isSchemaAssetUUID(record.editAssetId)) {
        return false
    }
    if ('entityRemoved' in record && record.entityRemoved !== undefined && record.entityRemoved !== true) {
        return false
    }
    return !hasMirrorOnlyFields(record)
}

export const isExampleInvalidatedEvent = (event: unknown): event is ComponentExamplesInvalidatedEvent => (
    isComponentScopedExampleInvalidated(event) || isSituationScopedExampleInvalidated(event)
)

/** Alias for {@link isExampleInvalidatedEvent}. */
export const isComponentExamplesInvalidatedEvent = isExampleInvalidatedEvent

export const isComponentExamplesEvent = (event: unknown): event is ComponentExamplesEvent => (
    event != null
    && typeof event === 'object'
    && typeof (event as { type?: unknown }).type === 'string'
    && (
        (event as { type: string }).type === 'ExampleAdded'
        || (event as { type: string }).type === 'ExampleUpdated'
        || (event as { type: string }).type === 'ExampleRemoved'
        || isExampleInvalidatedEvent(event)
    )
)


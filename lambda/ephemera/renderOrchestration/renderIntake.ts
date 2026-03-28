import type { RenderRequested } from './events'
import type { RenderResolveInput } from './baseClasses'

/** Successful passive A-phase: {@link RenderResolveInput} for the shared resolve step. */
export type PassiveIntakeResultOk = {
    type: 'ok';
    input: RenderResolveInput;
    payload: RenderRequested;
};

/** Meta::Room exists but `state.marks` missing; shell maps to bus `Error`. */
export type PassiveIntakeResultMarksMissing = {
    type: 'marks_missing';
    payload: RenderRequested;
};

/** `componentId` is not a room; shell maps to `lookup_handoff`. */
export type PassiveIntakeResultNotRoom = {
    type: 'not_room';
    payload: RenderRequested;
};

export type PassiveIntakeResult =
    | PassiveIntakeResultOk
    | PassiveIntakeResultMarksMissing
    | PassiveIntakeResultNotRoom;

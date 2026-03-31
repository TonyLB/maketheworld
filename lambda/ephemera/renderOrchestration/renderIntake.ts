import type { RenderRequested } from './events'
import type { RenderResolveInputSuccess } from './baseClasses'

/** Successful passive A-phase: {@link RenderResolveInputSuccess} for the shared resolve step. */
export type PassiveIntakeResultOk = {
    type: 'ok';
    input: RenderResolveInputSuccess;
    payload: RenderRequested;
};

/** Meta::Room exists but `state.marks` missing; shell maps to bus `Error`. */
export type PassiveIntakeResultMarksMissing = {
    type: 'marks_missing';
    payload: RenderRequested;
};

/** `componentId` is not a room; shell publishes `RenderError` (`RENDER_REQUESTED_NOT_ROOM`). */
export type PassiveIntakeResultNotRoom = {
    type: 'not_room';
    payload: RenderRequested;
};

export type PassiveIntakeResult =
    | PassiveIntakeResultOk
    | PassiveIntakeResultMarksMissing
    | PassiveIntakeResultNotRoom;

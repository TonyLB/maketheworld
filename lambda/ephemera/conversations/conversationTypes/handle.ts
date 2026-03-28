import type { ConversationHandleGenerateRoomPreview } from './generateRoomPreview';
import type { ConversationHandleRoomStateRender } from './roomStateRender';

/** Live conversation handles (storable row + runtime send). Grows with new pipeline variants. */
export type ConversationHandle = ConversationHandleGenerateRoomPreview | ConversationHandleRoomStateRender;

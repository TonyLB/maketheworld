/**
 * @fileoverview Message type definitions for client-server communication
 */

import { isRenderTreeNode, RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraAssetId,
    isEphemeraCharacterId,
    isEphemeraMapId,
    isEphemeraRoomId,
    isEphemeraId,
    LegalCharacterColor
} from "./baseClasses";
import { checkAll, checkTypes } from "./utils";
import { AssetUUID, ComponentUUID, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target?: EphemeraCharacterId | `SESSION#${string}`;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

export type CoyoteGameHelpMessage = {
    DisplayProtocol: 'CoyoteGameHelpMessage';
} & MessageAddressing

const isRenderTree = (message: any): message is RenderTree | undefined => {
    if (typeof message === 'undefined') {
        return true
    }
    if (Array.isArray(message) && message.every(isRenderTreeNode)) {
        return true
    }
    return false
}

export type WorldMessage = {
    DisplayProtocol: 'WorldMessage';
    Message: RenderTree;
} & MessageAddressing

/** System / out-of-world line: same wire shape as WorldMessage, distinct DisplayProtocol for UI (grey stripes). */
export type WorldOOCMessage = {
    DisplayProtocol: 'WorldOOCMessage';
    Message: RenderTree;
} & MessageAddressing

/** Player-submitted command echo for the message log: same wire shape as WorldMessage, distinct DisplayProtocol for client styling. */
export type CommandTranscriptMessage = {
    DisplayProtocol: 'CommandTranscriptMessage';
    Message: RenderTree;
} & MessageAddressing

/** Coyote compact hypothesis rows: same wire shape as WorldMessage, distinct DisplayProtocol for client routing. */
export type CoyoteGameHypothesisMessage = {
    DisplayProtocol: 'CoyoteGameHypothesisMessage';
    Message: RenderTree;
} & MessageAddressing

export type RoomExit = {
    Name: string;
    RoomId: EphemeraRoomId;
    Visibility: 'Public' | 'Private';
}

const validateRoomExitList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', RoomId: 'string' })
            && isEphemeraRoomId(roomItem.RoomId)
            && ['Public', 'Private'].includes(roomItem.Visibility)
    ), true)
}

export type RoomCharacter = {
    DisplayName: string;
    CharacterId: EphemeraCharacterId;
    fileURL?: string;
}

const validateRoomCharacterList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { DisplayName: 'string', CharacterId: 'string' })
            && isEphemeraCharacterId(roomItem.CharacterId)
    ), true)
}

export type RoomDescribeData = {
    Description: RenderTree;
    ShortName?: string;
    /** Plain-text display name (no render semantics). */
    DisplayName: string;
    Summary: RenderTree;
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
    assets?: AssetUUID[];
}





export type MapDescribeRoom = {
    roomId: EphemeraRoomId;
    shortName: string;
    x: number;
    y: number;
    exits: {
        description: string;
        to: EphemeraRoomId;
    }[];
}

export type MapDescribeData = {
    MapId: EphemeraMapId;
    shortName?: string;
    fileURL?: string;
    rooms: MapDescribeRoom[];
    assets?: AssetUUID[];
}

const validateMapRoomList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => {
        if (!(
            previous &&
            checkTypes(roomItem, { roomId: 'string', x: 'number', y: 'number' })
            && isEphemeraRoomId(roomItem.roomId)
        )) {
            return false
        }
        const exits = roomItem.exits
        if (!Array.isArray(exits)) {
            return false
        }
        return exits.reduce<boolean>((previous, exit) => (
            previous && checkTypes(exit, { description: 'string', to: 'string' }) && isEphemeraRoomId(exit.to)
        ), true)
    }, true)
}

export const isMapDescribeData = (message: any): message is MapDescribeData => {
    return checkAll(
        checkTypes(message, { MapId: 'string' }),
        !(message.fileURL && typeof message.fileURL !== 'string'),
        isEphemeraMapId(message.MapId),
        validateMapRoomList(message.rooms),
        isRenderTree(message.shortName)
    )
}





export type RoomUpdate = {
    DisplayProtocol: 'RoomUpdate';
} & MessageAddressing & Partial<RoomDescribeData>

type MessageCharacterInfo = {
    CharacterId: EphemeraCharacterId;
    DisplayName: string;
    Color: LegalCharacterColor;
    fileURL?: string;
}

export type CharacterSpeech = {
    DisplayProtocol: 'SayMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OOCMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

// WML Schema type for string-based WML transmission
export type WMLSchema = string

// PerceptionMessage MetaData Discriminated Union System
// Base metadata interface
type PerceptionMessageMetaDataBase = {
    componentUUID: ComponentUUID;
}

/** Multi-channel room UI: which logical channel this `PerceptionMessage` row belongs to (see `lambda/ephemera/AGENT.multiChannel.contract.md`). */
export type PerceptionRoomChannel = 'render' | 'affordances'

/** When `roomChannel` is omitted on stored or legacy messages, treat as render (backward compatible). */
export const DEFAULT_PERCEPTION_ROOM_CHANNEL: PerceptionRoomChannel = 'render'

// Component-specific metadata types
export type PerceptionRoomMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `ROOM#${string}`;
    displayMode: 'header' | 'full';
    //
    // status: Optional state indicator for Room perception messages.
    // - 'ready' (default): Room header/full description is fully rendered.
    // - 'generating': Placeholder header indicating that a new render is being generated.
    //
    status?: 'ready' | 'generating';
    /** Multi-channel discriminator: render-backed vs affordances payload. Omitted means `render` (legacy rows). */
    roomChannel?: PerceptionRoomChannel;
}

export type PerceptionFeatureMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `FEATURE#${string}`;
}

export type PerceptionKnowledgeMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `KNOWLEDGE#${string}`;
}

export type PerceptionCharacterMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `CHARACTER#${string}`;
}

export type PerceptionExampleMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `EXAMPLE#${string}`;
}

export type PerceptionMapMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `MAP#${string}`;
}

export type PerceptionImageMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `IMAGE#${string}`;
}

export type PerceptionActionMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `ACTION#${string}`;
}

export type PerceptionVariableMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `VARIABLE#${string}`;
}

export type PerceptionComputedMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `COMPUTED#${string}`;
}

export type PerceptionMessageComponentMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `MESSAGE#${string}`;
}

export type PerceptionMomentMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `MOMENT#${string}`;
}

export type PerceptionAssetMetaData = PerceptionMessageMetaDataBase & {
    componentUUID: `ASSET#${string}`;
}

// Discriminated union of all metadata types
export type PerceptionMessageMetaData = 
    | PerceptionRoomMetaData 
    | PerceptionFeatureMetaData 
    | PerceptionKnowledgeMetaData 
    | PerceptionCharacterMetaData
    | PerceptionExampleMetaData
    | PerceptionMapMetaData
    | PerceptionImageMetaData
    | PerceptionActionMetaData     // Deprecated but included for migration period
    | PerceptionVariableMetaData   // Deprecated but included for migration period
    | PerceptionComputedMetaData   // Deprecated but included for migration period
    | PerceptionMessageComponentMetaData
    | PerceptionMomentMetaData
    | PerceptionAssetMetaData

export type PerceptionMessage = {
    DisplayProtocol: 'PerceptionMessage';
    wmlContent: WMLSchema;
    metaData: PerceptionMessageMetaData;
} & MessageAddressing

// Type guard functions for runtime type narrowing
export const isPerceptionRoomMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionRoomMetaData => {
    return metaData.componentUUID.startsWith('ROOM#');
}

/** Resolved channel for room `PerceptionMessage` metadata (`undefined` roomChannel => `render`). */
export const resolvedPerceptionRoomChannel = (meta: PerceptionRoomMetaData): PerceptionRoomChannel =>
    meta.roomChannel ?? DEFAULT_PERCEPTION_ROOM_CHANNEL

export const isPerceptionFeatureMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionFeatureMetaData => {
    return metaData.componentUUID.startsWith('FEATURE#');
}

export const isPerceptionKnowledgeMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionKnowledgeMetaData => {
    return metaData.componentUUID.startsWith('KNOWLEDGE#');
}

export const isPerceptionCharacterMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionCharacterMetaData => {
    return metaData.componentUUID.startsWith('CHARACTER#');
}

export const isPerceptionExampleMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionExampleMetaData => {
    return metaData.componentUUID.startsWith('EXAMPLE#');
}

export const isPerceptionMapMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionMapMetaData => {
    return metaData.componentUUID.startsWith('MAP#');
}

export const isPerceptionImageMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionImageMetaData => {
    return metaData.componentUUID.startsWith('IMAGE#');
}

export const isPerceptionActionMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionActionMetaData => {
    return metaData.componentUUID.startsWith('ACTION#');
}

export const isPerceptionVariableMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionVariableMetaData => {
    return metaData.componentUUID.startsWith('VARIABLE#');
}

export const isPerceptionComputedMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionComputedMetaData => {
    return metaData.componentUUID.startsWith('COMPUTED#');
}

export const isPerceptionMessageComponentMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionMessageComponentMetaData => {
    return metaData.componentUUID.startsWith('MESSAGE#');
}

export const isPerceptionMomentMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionMomentMetaData => {
    return metaData.componentUUID.startsWith('MOMENT#');
}

export const isPerceptionAssetMetaData = (metaData: PerceptionMessageMetaData): metaData is PerceptionAssetMetaData => {
    return metaData.componentUUID.startsWith('ASSET#');
}

export type Message = SpacerMessage | CoyoteGameHelpMessage | WorldMessage | WorldOOCMessage | CommandTranscriptMessage | CoyoteGameHypothesisMessage | RoomUpdate | CharacterNarration | CharacterSpeech | OutOfCharacterMessage | PerceptionMessage

export const isMessage = (message: any): message is Message => {
    if (typeof message !== 'object') {
        return false
    }
    if (!checkTypes(message, { MessageId: 'string', CreatedTime: 'number' }, { Target: 'string' })) {
        return false
    }
    if (message.Target && !isEphemeraCharacterId(message.Target) && !(message.Target.startsWith('SESSION#') && message.Target.length > 8)) {
        return false
    }
    switch(message.DisplayProtocol) {
        case 'CoyoteGameHelpMessage':
            return true
        case 'WorldMessage':
        case 'WorldOOCMessage':
        case 'CommandTranscriptMessage':
        case 'CoyoteGameHypothesisMessage':
            return isRenderTree(message.Message)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage': {
            const legacyName = (message as { Name?: string }).Name
            const hasDisplayLabel = typeof message.DisplayName === 'string'
                || typeof legacyName === 'string'
            return checkAll(
                checkTypes(message, { CharacterId: 'string' }),
                hasDisplayLabel,
                ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color),
                isRenderTree(message.Message)
            ) && isEphemeraCharacterId(message.CharacterId)
        }

        case 'RoomUpdate':
            return checkAll(
                checkTypes(message, {}, { RoomId: 'string' }),
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                isRenderTree(message.DisplayName ?? []),
                isRenderTree(message.Description ?? []),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraRoomId(message.RoomId)

        case 'PerceptionMessage':
            return isPerceptionMessage(message)
        default: return false
    }
}

// Specific type guard for PerceptionMessage
export const isPerceptionMessage = (message: any): message is PerceptionMessage => {
    if (typeof message !== 'object' || message === null) {
        return false
    }
    if (message.DisplayProtocol !== 'PerceptionMessage') {
        return false
    }
    if (!checkTypes(message, {
        wmlContent: 'string',
        MessageId: 'string',
        CreatedTime: 'number'
    }, {
        Target: 'string'
    })) {
        return false
    }
    if (typeof message.wmlContent !== 'string' || message.wmlContent.length === 0) {
        return false
    }
    if (!message.metaData || typeof message.metaData !== 'object' || message.metaData === null) {
        return false
    }
    if (typeof message.metaData.componentUUID !== 'string' || !isSchemaComponentUUID(message.metaData.componentUUID)) {
        return false
    }
    if (message.Target && !isEphemeraCharacterId(message.Target) && !(message.Target.startsWith('SESSION#') && message.Target.length > 8)) {
        return false
    }
    return true
}

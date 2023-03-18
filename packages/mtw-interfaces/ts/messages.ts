import { EphemeraActionId, EphemeraAssetId, EphemeraBookmarkId, EphemeraCharacterId, EphemeraComputedId, EphemeraFeatureId, EphemeraMapId, EphemeraMessageId, EphemeraNotificationId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraAssetId, isEphemeraBookmarkId, isEphemeraCharacterId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, isEphemeraVariableId, LegalCharacterColor } from "./baseClasses";
import { checkAll, checkTypes } from "./utils";

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: EphemeraCharacterId;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

export type TaggedText = {
    tag: 'String';
    value: string;
}

export type TaggedLineBreak = {
    tag: 'LineBreak';
}

export type TaggedSpacer = {
    tag: 'Space';
}

export type TaggedLink = {
    tag: 'Link';
    text: string;
    to: EphemeraFeatureId | EphemeraActionId | EphemeraCharacterId;
}

export type TaggedLinkUnrestricted = {
    tag: 'Link',
    text: string;
    to: string;
}

export type TaggedBookmark = {
    tag: 'Bookmark';
    to: EphemeraBookmarkId;
}

export type TaggedBookmarkUnrestricted = {
    tag: 'Bookmark';
    to: string;
}

export type TaggedConditionalItemDependency = {
    key: string;
    EphemeraId: string;
}

export type TaggedConditionalStatement = {
    if: string;
    not?: boolean;
    dependencies: TaggedConditionalItemDependency[];
}

export type TaggedConditional = {
    tag: 'Condition';
    conditions: TaggedConditionalStatement[];
    contents: TaggedMessageContent[];
}

export type TaggedConditionalStatementUnrestricted = {
    if: string;
    not?: boolean;
    dependencies: string[];
}

export type TaggedConditionalUnrestricted = {
    tag: 'Condition';
    conditions: TaggedConditionalStatementUnrestricted[];
    contents: TaggedMessageContentUnrestricted[];
}

export type TaggedAfter = {
    tag: 'After';
    contents: TaggedMessageContent[];
}

export type TaggedBefore = {
    tag: 'Before';
    contents: TaggedMessageContent[];
}

export type TaggedReplace = {
    tag: 'Replace';
    contents: TaggedMessageContent[];
}

export type TaggedAfterUnrestricted = {
    tag: 'After';
    contents: TaggedMessageContentUnrestricted[];
}

export type TaggedBeforeUnrestricted = {
    tag: 'Before';
    contents: TaggedMessageContentUnrestricted[];
}

export type TaggedReplaceUnrestricted = {
    tag: 'Replace';
    contents: TaggedMessageContentUnrestricted[];
}

export type TaggedMessageContent = TaggedLink | TaggedBookmark | TaggedText | TaggedLineBreak | TaggedSpacer | TaggedConditional | TaggedAfter | TaggedBefore | TaggedReplace;

//
// TaggedMessageContentUnrestricted is a utility type which should (hopefully) match ComponentRenderItem from mtw-wml,
// and let the more basic of the message utility functions operate identically on both those types (since
// they share a lot of basic structure, with ComponentRenderItem using local keys rather than global ones)
//
export type TaggedMessageContentUnrestricted = TaggedLinkUnrestricted | TaggedBookmarkUnrestricted | TaggedText | TaggedLineBreak | TaggedSpacer | TaggedConditionalUnrestricted | TaggedAfterUnrestricted | TaggedBeforeUnrestricted | TaggedReplaceUnrestricted;

export type TaggedMessageContentFlat = TaggedLink | TaggedText | TaggedLineBreak;

export const isTaggedMessageContent = (message: any): message is TaggedMessageContent => {
    if (typeof message !== 'object') {
        return false
    }
    switch(message.tag) {
        case 'String':
            return checkTypes(message, { value: 'string' })
        case 'LineBreak':
        case 'Space':
            return true
        case 'Link':
            return checkTypes(message, { text: 'string', to: 'string' })
                && (isEphemeraFeatureId(message.to) || isEphemeraActionId(message.to) || isEphemeraCharacterId(message.to))
        case 'Bookmark':
            return checkTypes(message, { to: 'string' })
                && isEphemeraBookmarkId(message.to)
        case 'Condition':
            const { dependencies, contents } = message || {}
            return checkTypes(message, { if: 'string' })
                && Array.isArray(dependencies)
                && checkAll(...(dependencies || []).map((value) => (checkTypes(value, { key: 'string', EphemeraId: 'string' }) && (isEphemeraComputedId(value.EphemeraId) || isEphemeraVariableId(value.EphemeraId)))))
                && Array.isArray(contents)
                && checkAll(...contents.map(isTaggedMessageContent))
        default: return false
    }
}

export const isTaggedMessageContentFlat = (message: any): message is TaggedMessageContentFlat => (isTaggedMessageContent(message) && !isTaggedSpacer(message))

export type TaggedNotificationContent = TaggedText | TaggedLineBreak;

export const isTaggedNotificationContent = (notification: any): notification is TaggedNotificationContent => {
    if (typeof notification !== 'object') {
        return false
    }
    switch(notification.tag) {
        case 'String':
            return checkTypes(notification, { value: 'string' })
        case 'LineBreak':
            return true
        default: return false
    }
}

export const isTaggedLink = (item: TaggedMessageContent): item is TaggedLink => (item.tag === 'Link')
export const isTaggedBookmark = (item: TaggedMessageContent): item is TaggedBookmark => (item.tag === 'Bookmark')
export const isTaggedText = (item: TaggedMessageContent | TaggedMessageContentUnrestricted | TaggedNotificationContent): item is TaggedText => (item.tag === 'String')
export const isTaggedLineBreak = (item: TaggedMessageContent | TaggedNotificationContent): item is TaggedLineBreak => (item.tag === 'LineBreak')
export const isTaggedSpacer = (item: TaggedMessageContent): item is TaggedSpacer => (item.tag === 'Space')
export const isTaggedConditional = (item: TaggedMessageContent): item is TaggedConditional => (item.tag === 'Condition')
export const isTaggedAfter = (item: TaggedMessageContent): item is TaggedAfter => (item.tag === 'After')
export const isTaggedBefore = (item: TaggedMessageContent): item is TaggedBefore => (item.tag === 'Before')
export const isTaggedReplace = (item: TaggedMessageContent): item is TaggedReplace => (item.tag === 'Replace')

export const validateTaggedMessageList = (items: any): items is TaggedMessageContentFlat[] => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, item) => (
        previous && isTaggedMessageContentFlat(item)
    ), true)
}

export const validateTaggedNotificationList = (items: any): items is TaggedNotificationContent[] => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, item) => (
        previous && isTaggedNotificationContent(item)
    ), true)
}

export type FlattenTaggedMessageContentOptions = {
    evaluateConditional?: (ifTest: string, dependencies: TaggedConditionalItemDependency[]) => Promise<boolean>;
    renderBookmark?: (bookmark: EphemeraBookmarkId) => Promise<TaggedMessageContent[]>;
}

const evaluateTaggedMessageContent = async (messages: TaggedMessageContent[], options: FlattenTaggedMessageContentOptions): Promise<(TaggedMessageContentFlat | TaggedSpacer)[]> => {
    const {
        evaluateConditional = async (src) => (src === 'true' ? true : false),
        renderBookmark = async () => ([])
    } = options
    const evaluatedMessages: (TaggedMessageContentFlat | TaggedSpacer)[][] = await Promise.all(
        messages.map(async (message) => {
            if (isTaggedConditional(message)) {
                //
                // TODO: If we refactor the system to include performance modes (low, high, ultra, etc.) then this is a
                // good place to trade performance (as it's currently set, optimistically evaluating the entire conditional
                // tree before the first conditional is known good) for lower cost (which could be achieved by waiting to
                // create the nestingPromise until after evaluationPromise returns true)
                //
                const evaluationPromise = Promise.all(
                    message.conditions.map(async (condition) => {
                        const evaluation = await evaluateConditional(condition.if, condition.dependencies)
                        if (condition.not) {
                            return !Boolean(evaluation)
                        }
                        else {
                            return Boolean(evaluation)
                        }
                    })
                )
                const nestingPromise = flattenTaggedMessageContent(message.contents, { evaluateConditional })
                const evaluation = await evaluationPromise
                if (evaluation.reduce<boolean>((previous, statement) => (previous && statement), true)) {
                    return await nestingPromise
                }
                else {
                    return []
                }
            }
            else if (isTaggedAfter(message) || isTaggedBefore(message) || isTaggedReplace(message)) {
                return evaluateTaggedMessageContent(message.contents, options)
            }
            else if (isTaggedBookmark(message)) {
                const evaluatedContents = await renderBookmark(message.to)
                return evaluateTaggedMessageContent(evaluatedContents, options)
            }
            else {
                return [message]
            }
        })
    )
    return evaluatedMessages.reduce<(TaggedMessageContentFlat | TaggedSpacer)[]>((previous, outputMessages, index) => {
        const originalMessage = messages[index]
        if (!originalMessage) {
            return previous
        }
        if (isTaggedBefore(originalMessage)) {
            return [ ...outputMessages, ...previous ]
        }
        if (isTaggedReplace(originalMessage)) {
            return outputMessages
        }
        return [ ...previous, ...outputMessages ]
    }, [])
}

export const flattenTaggedMessageContent = async (messages: TaggedMessageContent[], options: FlattenTaggedMessageContentOptions = {}): Promise<TaggedMessageContentFlat[]> => {
    //
    // Recursively evaluated all conditionals
    //
    const evaluatedMessages = await evaluateTaggedMessageContent(messages, options)
    if (evaluatedMessages.length === 0) {
        return []
    }

    //
    // Initialize local state
    //
    let currentMessageQueued: TaggedMessageContent = evaluatedMessages[0]
    let currentReturnValue: TaggedMessageContentFlat[] = []

    //
    // Process each entry in relation to the current entry queued
    //
    evaluatedMessages.slice(1).forEach((message) => {
        if (isTaggedText(currentMessageQueued)) {
            if (isTaggedText(message)) {
                currentMessageQueued = {
                    ...currentMessageQueued,
                    value: `${currentMessageQueued.value}${message.value}`
                }
            }
            else if (isTaggedLineBreak(message)) {
                currentReturnValue.push({
                    ...currentMessageQueued,
                    value: currentMessageQueued.value.trimEnd()
                })
                currentMessageQueued = { ...message }
            }
            else if (isTaggedLink(message)) {
                currentReturnValue.push(currentMessageQueued)
                currentMessageQueued = { ...message }
            }
            else if (isTaggedSpacer(message)) {
                currentMessageQueued = {
                    ...currentMessageQueued,
                    value: `${currentMessageQueued.value.trimEnd()} `
                }
            }
        }
        else if (isTaggedLink(currentMessageQueued)) {
            currentReturnValue.push(currentMessageQueued)
            currentMessageQueued = { ...message }
        }
        else if (isTaggedLineBreak(currentMessageQueued)) {
            if (isTaggedLink(message)) {
                currentReturnValue.push(currentMessageQueued)
                currentMessageQueued = { ...message }
            }
            else if (isTaggedText(message)) {
                currentReturnValue.push(currentMessageQueued)
                currentMessageQueued = {
                    ...message,
                    value: message.value.trimStart()
                }
            }
            //
            // No-Op in the case of a Spacer or another LineBreak following a LineBreak
            //
        }
        else if (isTaggedSpacer(currentMessageQueued)) {
            if (isTaggedLineBreak(message)) {
                currentMessageQueued = { ...message }
            }
            else if (isTaggedLink(message)) {
                currentReturnValue.push({
                    tag: 'String',
                    value: ' '
                })
                currentMessageQueued = { ...message }
            }
            else if (isTaggedText(message)) {
                currentMessageQueued = {
                    ...message,
                    value: ` ${message.value.trimStart()}`
                }
            }
            //
            // No-Op in the case of a Spacer following a Spacer
            //
        }
    })

    //
    // Process the queued entry after you finish the list
    //
    if (!isTaggedSpacer(currentMessageQueued) && !isTaggedConditional(currentMessageQueued)) {
        currentReturnValue.push(currentMessageQueued)
    }

    return currentReturnValue.map((item, index) => {
        if (index === 0 && isTaggedText(item)) {
            return {
                ...item,
                value: item.value.trimStart()
            }
        }
        else if ((index === currentReturnValue.length - 1) && isTaggedText(item)) {
            return {
                ...item,
                value: item.value.trimEnd()
            }
        }
        return item
    })
}

export const taggedMessageToString = (message: (TaggedMessageContent | TaggedMessageContentUnrestricted)[]): string => {
    return message.map((item) => {
        if (isTaggedText(item)) {
            return item.value
        }
        else {
            return ''
        }
    }).join('')
}

export type WorldMessage = {
    DisplayProtocol: 'WorldMessage';
    Message: TaggedMessageContentFlat[];
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
    Name: string;
    CharacterId: EphemeraCharacterId;
    fileURL?: string;
}

const validateRoomCharacterList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', CharacterId: 'string' })
            && isEphemeraCharacterId(roomItem.CharacterId)
    ), true)
}

export type BookmarkDescribeData = {
    Description: TaggedMessageContentFlat[];
    BookmarkId: EphemeraBookmarkId;
    assets?: EphemeraAssetId[];
}

export type RoomDescribeData = {
    Description: TaggedMessageContentFlat[];
    Name: TaggedMessageContentFlat[];
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
    assets?: Record<EphemeraAssetId, string>;
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type FeatureDescribeData = {
    Description: TaggedMessageContentFlat[];
    Name: TaggedMessageContentFlat[];
    FeatureId: EphemeraFeatureId;
    assets?: Record<EphemeraAssetId, string>;
}

export type FeatureDescription = {
    DisplayProtocol: 'FeatureDescription';
} & FeatureDescribeData & MessageAddressing

export type MapDescribeRoom = {
    roomId: EphemeraRoomId;
    name: TaggedMessageContentFlat[];
    x: number;
    y: number;
    exits: {
        name: string;
        to: EphemeraRoomId;
    }[];
}

export type MapDescribeData = {
    MapId: EphemeraMapId;
    Name: TaggedMessageContentFlat[];
    fileURL?: string;
    rooms: MapDescribeRoom[];
    assets?: Record<EphemeraAssetId, string>;
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
            previous && checkTypes(exit, { name: 'string', to: 'string' }) && isEphemeraRoomId(exit.to)
        ), true)
    }, true)
}

export const isMapDescribeData = (message: any): message is MapDescribeData => {
    return checkAll(
        checkTypes(message, { MapId: 'string' }),
        !(message.fileURL && typeof message.fileURL !== 'string'),
        isEphemeraMapId(message.MapId),
        validateMapRoomList(message.rooms),
        validateTaggedMessageList(message.Name)
    )
}

type CharacterDescribeData = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    fileURL?: string;
    FirstImpression?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
    OneCoolThing?: string;
    Outfit?: string;
}

export type CharacterDescription = {
    DisplayProtocol: 'CharacterDescription';
} & CharacterDescribeData & MessageAddressing

export type RoomHeader = {
    DisplayProtocol: 'RoomHeader';
} & RoomDescribeData & MessageAddressing

export type RoomUpdate = {
    DisplayProtocol: 'RoomUpdate';
} & MessageAddressing & Partial<RoomDescribeData>

type MessageCharacterInfo = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    Color: LegalCharacterColor;
    fileURL?: string;
}

export type CharacterSpeech = {
    DisplayProtocol: 'SayMessage';
    Message: TaggedMessageContentFlat[];
} & MessageAddressing & MessageCharacterInfo

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    Message: TaggedMessageContentFlat[];
} & MessageAddressing & MessageCharacterInfo

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OOCMessage';
    Message: TaggedMessageContentFlat[];
} & MessageAddressing & MessageCharacterInfo

export type Message = SpacerMessage | WorldMessage | RoomDescription | RoomHeader | RoomUpdate | FeatureDescription | CharacterDescription | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export const isMessage = (message: any): message is Message => {
    if (typeof message !== 'object') {
        return false
    }
    if (!checkTypes(message, { MessageId: 'string', CreatedTime: 'number', Target: 'string' })) {
        return false
    }
    if (!isEphemeraCharacterId(message.Target)) {
        return false
    }
    switch(message.DisplayProtocol) {
        case 'WorldMessage':
            return validateTaggedMessageList(message.Message)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            return checkAll(
                checkTypes(message, { CharacterId: 'string', Name: 'string' }),
                ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color),
                validateTaggedMessageList(message.Message)
            ) && isEphemeraCharacterId(message.CharacterId)
        case 'RoomDescription':
        case 'RoomHeader':
            return checkAll(
                checkTypes(message, { RoomId: 'string' }),
                validateRoomExitList(message.Exits),
                validateRoomCharacterList(message.Characters),
                validateTaggedMessageList(message.Name),
                validateTaggedMessageList(message.Description),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraRoomId(message.RoomId)
        case 'RoomUpdate':
            return checkAll(
                checkTypes(message, {}, { RoomId: 'string' }),
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                validateTaggedMessageList(message.Name ?? []),
                validateTaggedMessageList(message.Description ?? []),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraRoomId(message.RoomId)
        case 'FeatureDescription':
            return checkAll(
                checkTypes(message, { FeatureId: 'string' }),
                validateTaggedMessageList(message.Name),
                validateTaggedMessageList(message.Description),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraFeatureId(message.FeatureId)
        case 'CharacterDescription':
            return checkAll(
                checkTypes(message, 
                    {
                        CharacterId: 'string',
                        Name: 'string'
                    },
                    {
                        fileUrl: 'string',
                        FirstImpression: 'string',
                        OneCoolThing: 'string',
                        Outfit: 'string'
                    }
                ),
                !message.Pronouns || checkTypes(message.Pronouns, {
                    subject: 'string',
                    object: 'string',
                    possessive: 'string',
                    adjective: 'string',
                    reflexive: 'string'
                })
            ) && isEphemeraCharacterId(message.CharacterId)
        default: return false
    }
}

export type NotificationBase = {
    NotificationId: EphemeraNotificationId;
    CreatedTime: number;
    Target: string;
    Subject: string;
    read?: boolean;
    archived?: boolean;
}

export type InformationNotification = {
    DisplayProtocol: 'Information';
    Message: TaggedNotificationContent[];
} & NotificationBase

export type UpdateMarksNotification = {
    DisplayProtocol: 'UpdateMarks';
    NotificationId: string;
    Target: string;
    UpdateTime: number;
    read?: boolean;
    archived?: boolean;
}

export type Notification = UpdateMarksNotification |
    InformationNotification

export const isNotification = (notification: any): notification is Notification => {
    if (typeof notification !== 'object') {
        return false
    }
    if (!checkTypes(notification, { NotificationId: 'string', Target: 'string' })) {
        return false
    }
    switch(notification.DisplayProtocol) {
        case 'UpdateMarks':
            return true
        case 'Information':
            return checkTypes(notification, { CreatedTime: 'number', Subject: 'string' }) &&
                validateTaggedNotificationList(notification.Message)
        default: return false
    }
}

export const isUpdateMarksNotification = (value: Notification): value is UpdateMarksNotification => (value.DisplayProtocol === 'UpdateMarks')

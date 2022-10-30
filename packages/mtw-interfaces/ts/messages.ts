import { EphemeraActionId, EphemeraCharacterId, EphemeraComputedId, EphemeraFeatureId, EphemeraMapId, EphemeraRoomId, EphemeraVariableId, isEphemeraActionId, isEphemeraCharacterId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, isEphemeraVariableId, LegalCharacterColor } from "./baseClasses";
import { checkAll, checkTypes } from "./utils";

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: EphemeraCharacterId;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

type TaggedText = {
    tag: 'String';
    value: string;
}

type TaggedLineBreak = {
    tag: 'LineBreak';
}

type TaggedSpacer = {
    tag: 'Space';
}

export type TaggedLink = {
    tag: 'Link',
    text: string;
    to: EphemeraFeatureId | EphemeraActionId | EphemeraCharacterId;
}

export type TaggedLinkUnrestricted = {
    tag: 'Link',
    text: string;
    to: string;
}

export type TaggedConditionalItemDependency = {
    key: string;
    EphemeraId: string;
}

export type TaggedConditional = {
    tag: 'Conditional';
    if: string;
    dependencies: TaggedConditionalItemDependency[];
    contents: TaggedMessageContent[];
}

export type TaggedConditionalUnrestricted = {
    tag: 'Conditional';
    if: string;
    dependencies: TaggedConditionalItemDependency[];
    contents: TaggedMessageContentUnrestricted[];
}

export type TaggedMessageContent = TaggedLink | TaggedText | TaggedLineBreak | TaggedSpacer | TaggedConditional;

export type TaggedMessageContentUnrestricted = TaggedLinkUnrestricted | TaggedText | TaggedLineBreak | TaggedSpacer | TaggedConditionalUnrestricted;

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
        case 'Conditional':
            const { dependencies, contents } = message || {}
            return checkTypes(message, { if: 'string' })
                && Array.isArray(dependencies)
                && checkAll(...(dependencies || []).map((value) => (checkTypes(value, { key: 'string', EphemeraId: 'string' }) && (isEphemeraComputedId(value.EphemeraId) || isEphemeraVariableId(value.EphemeraId)))))
                && Array.isArray(contents)
                && checkAll(...contents.map(isTaggedMessageContent))
        default: return false
    }
}

export const isTaggedLink = (item: TaggedMessageContent): item is TaggedLink => (item.tag === 'Link')
export const isTaggedText = (item: TaggedMessageContent | TaggedMessageContentUnrestricted): item is TaggedText => (item.tag === 'String')
export const isTaggedLineBreak = (item: TaggedMessageContent): item is TaggedLineBreak => (item.tag === 'LineBreak')
export const isTaggedSpacer = (item: TaggedMessageContent): item is TaggedSpacer => (item.tag === 'Space')
export const isTaggedConditional = (item: TaggedMessageContent): item is TaggedConditional => (item.tag === 'Conditional')

export const isTaggedMessageContentFlat = (message: any): message is TaggedMessageContentFlat => (isTaggedMessageContent(message) && !isTaggedSpacer(message))

export const validateTaggedMessageList = (items: any): items is TaggedMessageContentFlat[] => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, item) => (
        previous && isTaggedMessageContentFlat(item)
    ), true)
}

type FlattenTaggedMessageContentOptions = {
    evaluateConditional?: (ifTest: string, dependencies: TaggedConditionalItemDependency[]) => Promise<boolean>;
}

const evaluateTaggedMessageContent = async (messages: TaggedMessageContent[], options: FlattenTaggedMessageContentOptions): Promise<(TaggedMessageContentFlat | TaggedSpacer)[]> => {
    const { evaluateConditional = async (src) => (src === 'true' ? true : false) } = options
    const evaluatedMessages: (TaggedMessageContentFlat | TaggedSpacer)[][] = await Promise.all(
        messages.map(async (message) => {
            if (isTaggedConditional(message)) {
                //
                // TODO: If we refactor the system to include performance modes (low, high, ultra, etc.) then this is a
                // good place to trade performance (as it's currently set, optimistically evaluating the entire conditional
                // tree before the first conditional is known good) for lower cost (which could be achieved by waiting to
                // create the nestingPromise until after evaluationPromise returns true)
                //
                const evaluationPromise = evaluateConditional(message.if, message.dependencies)
                const nestingPromise = flattenTaggedMessageContent(message.contents, { evaluateConditional })
                const evaluation = await evaluationPromise
                if (evaluation) {
                    return await nestingPromise
                }
                else {
                    return []
                }
            }
            else {
                return [message]
            }
        })
    )
    return evaluatedMessages.reduce<(TaggedMessageContentFlat | TaggedSpacer)[]>((previous, messages) => ([ ...previous, ...messages ]), [])
}

export const flattenTaggedMessageContent = async (messages: TaggedMessageContent[], options: FlattenTaggedMessageContentOptions = {}): Promise<TaggedMessageContentFlat[]> => {
    if (messages.length === 0) {
        return []
    }
    //
    // Recursively evaluated all conditionals
    //
    const evaluatedMessages = await evaluateTaggedMessageContent(messages, options)

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

export type RoomDescribeData = {
    Description: TaggedMessageContentFlat[];
    Name: TaggedMessageContentFlat[];
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type FeatureDescribeData = {
    Description: TaggedMessageContentFlat[];
    Name: TaggedMessageContentFlat[];
    FeatureId: EphemeraFeatureId;
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
                validateTaggedMessageList(message.Description)
            ) && isEphemeraRoomId(message.RoomId)
        case 'RoomUpdate':
            return checkAll(
                checkTypes(message, {}, { RoomId: 'string' }),
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                validateTaggedMessageList(message.Name ?? []),
                validateTaggedMessageList(message.Description ?? [])
            ) && isEphemeraRoomId(message.RoomId)
        case 'FeatureDescription':
            return checkAll(
                checkTypes(message, { FeatureId: 'string' }),
                validateTaggedMessageList(message.Name),
                validateTaggedMessageList(message.Description)
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
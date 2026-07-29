/**
 * Character component perception: Meta::Character from DynamoDB to PerceptionMessage PublishMessage.
 * Shared by mtw.ephemera.perception receiveEvents (and tests).
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { CharacterPerceptionRequestedCommand } from './localApiEvents'

type EphemeraCharacter = {
    Name?: string;
    Pronouns?: string;
    fileURL?: string;
    Color?: string;
    [key: string]: unknown;
}

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export async function handleCharacterPerceptionRequested(
    command: CharacterPerceptionRequestedCommand,
    messageBus: MessageBus
): Promise<void> {
    const { characterId, ephemeraId } = command

    const characterDescription = (await ephemeraDB.getItem<EphemeraCharacterDescription>({
        Key: {
            EphemeraId: ephemeraId,
            DataCategory: 'Meta::Character',
        },
        ProjectionFields: ['Name', 'Pronouns', 'fileURL', 'Color'],
    })) || {
        Name: 'Unknown',
        Pronouns: 'they/them',
    }

    const { Name: displayName = 'Unknown', Pronouns = 'they/them' } = characterDescription
    const fileURL = ('fileURL' in characterDescription) ? characterDescription.fileURL : undefined
    const imageTag = fileURL ? `<Image key=(portrait) fileURL="${fileURL}" />` : ''
    const wmlContent = `<Asset uuid=(render)>
    <Character uuid=(${ephemeraId})>
        <DisplayName>${displayName}</DisplayName>
        <Pronouns>${Pronouns}</Pronouns>
        ${imageTag}
    </Character>
</Asset>`

    messageBus.publish({
        type: 'PublishMessage',
        targets: [characterId],
        displayProtocol: 'PerceptionMessage',
        wmlContent,
        metaData: {
            componentUUID: ephemeraId,
        },
    })
}

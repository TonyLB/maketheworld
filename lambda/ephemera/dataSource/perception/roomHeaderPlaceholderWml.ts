/**
 * Header placeholder WML aligned with imperative {@link sendRoomGeneratingHeader} in perception/index.ts.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/** Ephemera wire `<Render>` placeholder (parse with `standardizeMode: 'ephemeraWire'`). */
export function roomHeaderGeneratingPlaceholderWml(roomId: EphemeraRoomId): string {
    return `<Asset uuid=(render)>
    <Room uuid=(${roomId})>
        <Render>
            <DisplayName>Generating...</DisplayName>
            <Summary></Summary>
            <Description></Description>
        </Render>
    </Room>
</Asset>`
}

/** Dirt-simple header-shaped error placeholder (parallel to full-room Error placeholder in orchestrate). */
export function roomHeaderErrorPlaceholderWml(roomId: EphemeraRoomId): string {
    return `<Asset uuid=(render)>
    <Room uuid=(${roomId})>
        <Render>
            <DisplayName>Error</DisplayName>
            <Summary></Summary>
            <Description></Description>
        </Render>
    </Room>
</Asset>`
}

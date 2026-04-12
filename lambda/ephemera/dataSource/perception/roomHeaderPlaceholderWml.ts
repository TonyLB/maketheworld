/**
 * Header placeholder WML aligned with imperative {@link sendRoomGeneratingHeader} in perception/index.ts.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/** Same markup as legacy `sendRoomGeneratingHeader` (Generating...). */
export function roomHeaderGeneratingPlaceholderWml(roomId: EphemeraRoomId): string {
    return `<Asset uuid=(render)>
    <Room uuid=(${roomId})>
        <Example key=(generatingHeader) uuid=(EXAMPLE#generatingHeader)>
            <DisplayName>Generating...</DisplayName>
        </Example>
    </Room>
</Asset>`
}

/** Dirt-simple header-shaped error placeholder (parallel to full-room Error placeholder in orchestrate). */
export function roomHeaderErrorPlaceholderWml(roomId: EphemeraRoomId): string {
    return `<Asset uuid=(render)>
    <Room uuid=(${roomId})>
        <Example key=(errorHeader) uuid=(EXAMPLE#errorHeader)>
            <DisplayName>Error</DisplayName>
        </Example>
    </Room>
</Asset>`
}

import { LegalCharacterColor } from "@tonylb/mtw-interfaces/ts/baseClasses";

export const defaultColorFromCharacterId = (CharacterId: string): LegalCharacterColor => (
    (['green', 'purple', 'pink'] as LegalCharacterColor[])[parseInt(CharacterId.slice(0, 3), 16) % 3]
)

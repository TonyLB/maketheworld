import { LegalCharacterColor } from "@tonylb/mtw-interfaces/dist/baseClasses";

export const defaultColorFromCharacterId = (CharacterId: string): LegalCharacterColor => (
    (['green', 'purple', 'pink'] as LegalCharacterColor[])[parseInt(CharacterId.slice(0, 3), 16) % 3]
)

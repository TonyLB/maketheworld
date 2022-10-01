export const defaultColorFromCharacterId = (CharacterId: string): string => (
    ['green', 'purple', 'pink'][parseInt(CharacterId.slice(0, 3), 16) % 3]
)

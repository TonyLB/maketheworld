export type SchemaTagType = 
    'Asset' |
    'Pronouns' |
    'Character' |
    'Image' |
    'Variable' |
    'Computed' |
    'Action' |
    'Import' |
    'Meta' |
    'Selected' |
    'If' |
    'ElseIf' |
    'Else' |
    'Remove' |
    'Replace' |
    'With' |
    'Exit' |
    'Description' |
    'Summary' |
    'br' |
    'Space' |
    'Link' |
    'ShortName' |
    'Match' |
    'DisplayName' |
    'Example' |
    'Room' |
    'Feature' |
    'Knowledge' |
    'Position' |
    'Map' |
    'Mark' |
    'String' |
    'Message' |
    'Moment' |
    'Grant' |
    'Parent' |
    'Key'

export const isLegalSchemaTag = (value: any): value is SchemaTagType => (
    typeof value === 'string' && [
        'Asset',
        'Pronouns',
        'Character',
        'Image',
        'Variable',
        'Computed',
        'Action',
        'Import',
        'Meta',
        'Selected',
        'If',
        'ElseIf',
        'Else',
        'Remove',
        'Replace',
        'With',
        'Exit',
        'Description',
        'Summary',
        'br',
        'Space',
        'Link',
        'ShortName',
        'Match',
        'DisplayName',
        'Example',
        'Room',
        'Feature',
        'Knowledge',
        'Position',
        'Map',
        'Mark',
        'String',
        'Message',
        'Moment',
        'Grant',
        'Parent',
        'Key'
    ].includes(value)
)

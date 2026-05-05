/** Concentrated partition key for canonical session metadata rows in the connections table. */
export const META_SESSION_PK = 'Meta::Session' as const

export const sessionMetaSortKey = (sessionId: string): `SESSION#${string}` =>
    `SESSION#${sessionId}`

/** Bare session id from a concentrated-meta sort key (`SESSION#...`). */
export const sessionIdFromMetaSortKey = (dataCategory: string): string | undefined => {
    if (!dataCategory.startsWith('SESSION#')) {
        return undefined
    }
    return dataCategory.slice(8)
}

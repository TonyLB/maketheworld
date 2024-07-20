export const anonymousAPIPromise = async (args: { path: 'validateInvitation', inviteCode: string, AnonymousApiURI: string }): Promise<boolean> => {
    const results = await fetch(
        `${args.AnonymousApiURI}/${args.path}`,
        {
            method: 'POST',
            body: JSON.stringify({ invitationCode: args.inviteCode })
        }
    )
    const { valid } = await results.json()
    return Boolean(valid)
}
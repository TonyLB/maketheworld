type AnonymousAPIRequestValidate = {
    path: 'validateInvitation';
    inviteCode: string;
}

type AnonymousAPIResultValidate = boolean

type AnonymousAPIRequestSignIn = {
    path: 'signIn';
    userName: string;
    password: string;
}

type AnonymousAPIResultSignInSuccess = {
    AccessToken: string;
    IdToken: string;
    RefreshToken: string;
}

type AnonymousAPIResultSignInFailure = {
    errorMessage: string
}

type AnonymousAPIResultSignIn = AnonymousAPIResultSignInSuccess | AnonymousAPIResultSignInFailure

export const isAnonymousAPIResultSignInSuccess = (value: AnonymousAPIResultSignIn): value is AnonymousAPIResultSignInSuccess => ('AccessToken' in value)
export const isAnonymousAPIResultSignInFailure = (value: AnonymousAPIResultSignIn): value is AnonymousAPIResultSignInFailure => ('errorMessage' in value)

type AnonymousAPIRequest = AnonymousAPIRequestValidate | AnonymousAPIRequestSignIn

const isAnonymousAPIRequestValidate = (value: AnonymousAPIRequest): value is AnonymousAPIRequestValidate => (value.path === 'validateInvitation')
const isAnonymousAPIRequestSignIn = (value: AnonymousAPIRequest): value is AnonymousAPIRequestSignIn => (value.path === 'signIn')

type AnonymousAPIResult = AnonymousAPIResultValidate | AnonymousAPIResultSignIn

export async function anonymousAPIPromise (args: AnonymousAPIRequestValidate, AnonymousApiURI: string): Promise<AnonymousAPIResultValidate>
export async function anonymousAPIPromise (args: AnonymousAPIRequestSignIn, AnonymousApiURI: string): Promise<AnonymousAPIResultSignIn>
export async function anonymousAPIPromise (args: AnonymousAPIRequest, AnonymousApiURI: string): Promise<AnonymousAPIResult> {
    if (isAnonymousAPIRequestValidate(args)) {
        const results = await fetch(
            `${AnonymousApiURI}/${args.path}`,
            {
                method: 'POST',
                body: JSON.stringify({ invitationCode: args.inviteCode })
            }
        )
        const { valid } = await results.json()
        return Boolean(valid)
    }
    if (isAnonymousAPIRequestSignIn(args)) {
        const results = await fetch(
            `${AnonymousApiURI}/${args.path}`,
            {
                method: 'POST',
                body: JSON.stringify({ userName: args.userName, password: args.password })
            }
        )
        if (results.status === 200) {
            const { AccessToken, IdToken, RefreshToken } = await results.json()
            return { AccessToken, IdToken, RefreshToken }
        }
        else {
            const { errorMessage } = await results.json()
            return { errorMessage }
        }
    }
}

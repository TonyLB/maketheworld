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
    errorField?: string;
    errorMessage: string;
}

type AnonymousAPIResultSignIn = AnonymousAPIResultSignInSuccess | AnonymousAPIResultSignInFailure

export const isAnonymousAPIResultSignInSuccess = (value: AnonymousAPIResultSignIn): value is AnonymousAPIResultSignInSuccess => ('AccessToken' in value)
export const isAnonymousAPIResultSignInFailure = (value: AnonymousAPIResultSignIn): value is AnonymousAPIResultSignInFailure => ('errorMessage' in value)

type AnonymousAPIRequestAccessToken = {
    path: 'accessToken';
    RefreshToken: string;
}

type AnonymousAPIResultAccessTokenSuccess = {
    AccessToken: string;
    IdToken: string;
}

type AnonymousAPIResultAccessTokenFailure = {
    errorMessage: string
}

type AnonymousAPIResultAccessToken = AnonymousAPIResultAccessTokenSuccess | AnonymousAPIResultAccessTokenFailure

type AnonymousAPIRequestSignUp = {
    path: 'signUp';
    inviteCode: string;
    userName: string;
    password: string;
}

export const isAnonymousAPIResultAccessTokenSuccess = (value: AnonymousAPIResultAccessToken): value is AnonymousAPIResultSignInSuccess => ('AccessToken' in value)
export const isAnonymousAPIResultAccessTokenFailure = (value: AnonymousAPIResultAccessToken): value is AnonymousAPIResultSignInFailure => ('errorMessage' in value)

type AnonymousAPIRequest = AnonymousAPIRequestValidate | AnonymousAPIRequestSignIn | AnonymousAPIRequestAccessToken | AnonymousAPIRequestSignUp

const isAnonymousAPIRequestValidate = (value: AnonymousAPIRequest): value is AnonymousAPIRequestValidate => (value.path === 'validateInvitation')
const isAnonymousAPIRequestSignIn = (value: AnonymousAPIRequest): value is AnonymousAPIRequestSignIn => (value.path === 'signIn')
const isAnonymousAPIRequestAccessToken = (value: AnonymousAPIRequest): value is AnonymousAPIRequestAccessToken => (value.path === 'accessToken')
const isAnonymousAPIRequestSignUp = (value: AnonymousAPIRequest): value is AnonymousAPIRequestSignUp => (value.path === 'signUp')

type AnonymousAPIResult = AnonymousAPIResultValidate | AnonymousAPIResultSignIn | AnonymousAPIResultAccessToken

export async function anonymousAPIPromise (args: AnonymousAPIRequestAccessToken, AnonymousApiURI: string): Promise<AnonymousAPIResultAccessToken>
export async function anonymousAPIPromise (args: AnonymousAPIRequestValidate, AnonymousApiURI: string): Promise<AnonymousAPIResultValidate>
export async function anonymousAPIPromise (args: AnonymousAPIRequestSignIn, AnonymousApiURI: string): Promise<AnonymousAPIResultSignIn>
export async function anonymousAPIPromise (args: AnonymousAPIRequestSignUp, AnonymousApiURI: string): Promise<AnonymousAPIResultSignIn>
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
    if (isAnonymousAPIRequestSignUp(args)) {
        const results = await fetch(
            `${AnonymousApiURI}/${args.path}`,
            {
                method: 'POST',
                body: JSON.stringify({ inviteCode: args.inviteCode, userName: args.userName, password: args.password })
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
    if (isAnonymousAPIRequestAccessToken(args)) {
        const results = await fetch(
            `${AnonymousApiURI}/${args.path}`,
            {
                method: 'POST',
                body: JSON.stringify({ RefreshToken: args.RefreshToken })
            }
        )
        if (results.status === 200) {
            const { AccessToken, IdToken } = await results.json()
            return { AccessToken, IdToken }
        }
        else {
            const { errorMessage } = await results.json()
            return { errorMessage }
        }
    }
}

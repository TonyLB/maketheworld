import { CognitoJwtVerifier } from "aws-jwt-verify"

const { COGNITO_POOL_ID, COGNITO_USER_POOL_CLIENT } = process.env

export const validateJWT = async (token) => {

    if (!token || !COGNITO_USER_POOL_CLIENT || !COGNITO_POOL_ID) {
        return {}
    } else {
        const idTokenVerifier = CognitoJwtVerifier.create([{
            userPoolId: COGNITO_POOL_ID,
            tokenUse: "id",
            clientId: COGNITO_USER_POOL_CLIENT, // clientId is mandatory at verifier level now, to disambiguate between User Pools
        }])
          
        try {
            const idTokenPayload = await idTokenVerifier.verify(token)
            return { userName: idTokenPayload["cognito:username"] }
        } catch {
            return {}
        }
    }
};

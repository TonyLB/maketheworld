import fetch from 'node-fetch'
import jose from 'node-jose'

const { COGNITO_KEYS_URL, COGNITO_USER_POOL_CLIENT } = process.env

export const validateJWT = async (token) => {

    if (!token) {
        return {}
    } else {
        // Get the kid from the headers prior to verification
        const sections = token.split('.')
        let header = jose.util.base64url.decode(sections[0])
        header = JSON.parse(header)
        const kid = header.kid

        // Fetch known valid keys
        const rawRes = await fetch(COGNITO_KEYS_URL)
        const response = await rawRes.json()

        if (rawRes.ok) {
            const keys = response['keys']
            const foundKey = keys.find((key) => key.kid === kid)

            if (!foundKey) {
                console.log('Public key not found in jwks.json')
                return {}
            } else {
                try {
                    const result = await jose.JWK.asKey(foundKey)
                    const keyVerify = jose.JWS.createVerify(result)
                    const verificationResult = await keyVerify.verify(token)

                    const claims = JSON.parse(verificationResult.payload)

                    // Verify the token expiration
                    const currentTime = Math.floor(new Date() / 1000)
                    if (currentTime > claims.exp) {
                        console.error('Token expired!')
                        return {}
                    } else if (claims.aud !== COGNITO_USER_POOL_CLIENT) {
                        console.error('Token wasn\'t issued for target audience')
                        return {}
                    } else {
                        return { userName: claims["cognito:username"] }
                    }
                } catch (error) {
                    console.error('Unable to verify token', error);
                    return {}
                }
            }
        }
    }
};

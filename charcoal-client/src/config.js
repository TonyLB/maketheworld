export const WSS_ADDRESS="wss://hi5j51s286.execute-api.us-east-1.amazonaws.com/Prod"
export const HTTPS_ADDRESS="https://czgn9cuinc.execute-api.us-east-1.amazonaws.com/Prod"

export const AuthConfig = {
    Auth: {
        // REQUIRED - Amazon Cognito Region
        region: 'us-east-1',

        // OPTIONAL - Amazon Cognito User Pool ID
        userPoolId: 'us-east-1_legdibKxO',

        // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
        userPoolWebClientId: '6h5qu9kboujj893l4cnhrccp6o',

        // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
        mandatorySignIn: true,

        // // OPTIONAL - Configuration for cookie storage
        // // Note: if the secure flag is set to true, then the cookie transmission requires a secure protocol
        // cookieStorage: {
        // // REQUIRED - Cookie domain (only required if cookieStorage is provided)
        //     domain: '.yourdomain.com',
        // // OPTIONAL - Cookie path
        //     path: '/',
        // // OPTIONAL - Cookie expiration in days
        //     expires: 365,
        // // OPTIONAL - Cookie secure flag
        // // Either true or false, indicating if the cookie transmission requires a secure protocol (https).
        //     secure: true
        // },

        // // OPTIONAL - customized storage object
        // storage: new MyStorage(),

        // OPTIONAL - Manually set the authentication flow type. Default is 'USER_SRP_AUTH'
        authenticationFlowType: 'USER_SRP_AUTH',

        // oauth: {
        //     domain: 'burnedoverdev-auth',
        //     scope: ['email', 'profile'],
        //     redirectSignIn: 'http://localhost:3000/',
        //     redirectSignOut: 'http://localhost:3000/',
        //     responseType: 'code' // or 'token', note that REFRESH token will only be generated when the responseType is code
        // }
    }
}
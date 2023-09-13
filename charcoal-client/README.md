This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

The charcoal client (named in honor of our first "Burned Over" world setting) is a React front-end client to the
Make The World system.

If you want to tinker with the system directly, it is an only slightly tweaked Create-React-App installation.
The interface with the AWS resources is handled by the `npm run introspect` command (see below) which populate
all variables needed for the client.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run introspect <your stack name>`

Pulls client-relevant information from the main MTW Cloudformation stack.  This must be run after install of the stack,
and piped into charcoal-client/src/config.json in UTF-8 format, before the client is ready to start or to build.  AWS
stack description sometimes returns UTF16le when executed on the command line, so we've created a helper function to
do the conversion, which you can run as follows:

```
npm run introspect (your stack name)
```

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed, though you'd obviously be better off using the deployment features of Amplify,
per normal Make The World install instructions.

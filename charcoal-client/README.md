This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

The charcoal client (named in honor of our first "Burned Over" world setting) is a React front-end client to the
Make The World system.

If you want to tinker with the system directly, it is an only slightly tweaked Create-React-App installation.
The interface with the AWS resources is handled by the `npm run introspect` command (see below) which populate
all variables needed for the client.

If you are familiar with AWS Amplify, you will see a lot of that code here.  However, we could not commit fully
to the Amplify lifecycle (because of the limits around custom Cloudformation, as of the time of build) and still
deploy in the way Make The World needed.  So this is a manual Amplify build, which does not need to have
`amplify init` run ... in fact, it's probably very much better that you don't.  If you tweak the graphQL schema
of the back-end, however, you will need to use `aws appsync get-introspection-schema` on your API, and pipe it
in JSON format into src/schema.json, then run `amplify configure` in order to repopulate the graphQL schemata.

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

### `npm run introspect --stack-name=<your stack name>`

Pulls client-relevant information from the main MTW Cloudformation stack.  This must be run after install of the stack,
and piped into charcoal-client/src/config.json in UTF-8 format, before the client is ready to start or to build.

A typical way to do this is to set the PYTHONIOENCODING environment variable to 'UTF-8' (however your local
environment calls for doing that), and then run:

`npm run --silent introspect --stack-name=(your stack name) > config.json`

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed, though you'd obviously be better off using the deployment features of Amplify,
per normal Make The World install instructions.

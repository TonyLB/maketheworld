1. If you are not already at the IAM console, use either (a) your AWS account email address and password or (b) your new IAM administrator ID and its password
to sign in as the AWS account root user to the IAM console at [IAM](https://console.aws.amazon.com/iam/).

2. Choose Roles from the left navigation bar, then choose Create role.

3. You will be presented a choice of "Type of trusted entity".  Since this is a role to empower the AWS Amplify service, select "AWS Service".

4. Under "Choose a Use Case" you will see a large list under "Or select a service to view its use cases".  You want to find *Amplify*.  Click it.

5. A new section should have appeared, saying "Select your use case" and giving you only one option:  Amplify - Backend Deployment.  That's correct,
so you can click the "Next: Permissions" button at bottom right.

6. The permission screen will show that you're granting Amplify administrator permissions.  That's fine.  Click "Next: Tags".

7. We never enter tags, because we're not that organized.  Click "Next: Review".

8. Select a role name.  AWS recommends developer-style names like *AmplifyConsoleServiceRole-AmplifyRole*, but you can call it anything you'll remember.

9.  Click "Create Role".

(For more details and documentation, see the Service Role tutorial on [Create a Service Role](https://docs.aws.amazon.com/amplify/latest/userguide/how-to-service-role-amplify-console.html))

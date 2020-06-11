1. Use your AWS account email address and password to sign in as the AWS account root user to the IAM console at [IAM](https://console.aws.amazon.com/iam/).

2. In the navigation pane, choose Users and then choose Add user.

3. On the Details page, do the following:
    a. For User name, type Administrator (or whatever you'll remember).
    b. Select the check box for AWS Management Console access, select Custom password, and then type your new password in the text box.
    c. By default, AWS forces the new user to create a new password when first signing in. You probably want to clear the check box next to *User must create a new password at next sign-in* to save yourself the hassle.
    d. Choose Next: Permissions.

4. On the Permissions page, do the following:
    a. Choose Add user to group.
    b. Choose Create group.
    c. In the Create group dialog box, for Group name type Administrators.
    d. Select the check box for the AdministratorAccess policy.
    e. Choose Create group.

5. Back on the page with the list of groups, select the check box for your new group. Choose Refresh if you don't see the new group in the list.  Now the user you are adding is assigned to the administrator group, with appropriate privileges.

6. Choose Next: Tags, but don't bother making any tags.

7. Choose Next: Review. Verify the group memberships to be added to the new user. When you are ready to proceed, choose Create user.

8. (Optional) On the Complete page, you can download a .csv file with login information for the user, or send email with login instructions to the user.

9. On the IAM Console dashboard, you'll be able to find an entry labelled "IAM users sign-in link", which gives you the URL to visit in order to sign in to your
account.  You'll want to bookmark that.  When any future step says "Go to the AWS Console", it will involve going to that web-site and entering your IAM name
and password.

10.  Do **not** close the IAM Console yet.  You still have another role to create, in the next section.


(For more details and documentation, see the IAM tutorial on [Create an IAM Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html))
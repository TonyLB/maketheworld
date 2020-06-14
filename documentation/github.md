Context:  GitHub is a place to store and collaborate upon computer code.  It holds the code for a system (in all its versions and evolutions) in a *repository*.  Within
the repository, there will be one or more (potentially many more) *branches*, which represent a particular way that the code has evolved.  New branches can
be made that start as a copy of an existing branch (and then may change independently of it), and existing branches may have code from other branches *merged*
into them, to include those changes.

The AWS Amplify system will create your application by looking at one particular *branch* of code in your GitHub *repository*.  In the course of this section,
we will create a repository with the correct branch of code for you to run a system off of:

1. If you haven't already signed up for GitHub, that is your first step (fortunately it's an easy one compared to what you've already done): [Sign up for GitHub](https://www.wikihow.com/Create-an-Account-on-GitHub)
2. Once you have signed up for GitHub, navigate back to the repository that holds the MTW code: [MTW Repository](https://github.com/TonyLB/maketheworld)
3. At the top of the page, on the right, you will find a box with the word "Fork" in it (and the number of people who have so far forked the repository).  Click that box.
4. Return to your own GitHub page.  You should find that you have a repository in your listing which is a copy of MTW.  Click to enter that repository.
5. You should see code just the same as in the base repository.  You could deploy into AWS from this repository right now, and connect it directly to the
"Version-One-Zero" branch ... but you will have more flexibility in future if you take a moment now to create a branch that's just for your specific MTW application.
Look down past the description at the top of the page, past the line that says "??? commits ? branches ? packages etc.", and you will see a button that says "Branch: Version-One-Ze..."
(or something like that).  You want to make sure that you have selected branch "Version-One-Zero", so click that button and select it from the list.
6. Now that you have the correct branch selected, we are going to make a new branch with exactly the same code:  Click the button again, and you will observe that it has
a text box.  Enter a name for your new branch (note:  You can't use spaces, but you can use dashes as you've seen), and GitHub will create a new branch from Verison-One-Zero
with your chosen name.

*NOTE: If you want to install more than one MTW instance on your AWS account, that is possible.  Just come back to GitHub and make another branch with another name ... then
go through the steps that will follow, to associate that branch with AWS resources.*

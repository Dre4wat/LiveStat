# Put LiveStat on GitHub (source code only)

This repository holds the code for LiveStat v0.7. Publishing source to GitHub does **not** start the Node.js server or enable live notifications. GitHub Pages by itself cannot host this Node.js backend.

## Quick setup

1. Sign into GitHub and create a new **empty** repository named `LiveStat` at https://github.com/new. Keep it empty: do not initialize README, .gitignore, or license.
2. In a terminal in this folder, run the commands below. Replace `YOUR_GITHUB_USERNAME` with your GitHub username.

```sh
git init
git branch -M main
git add .
git commit -m "Initial LiveStat v0.7"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/LiveStat.git
git push -u origin main
```

Alternatively, once the repository exists, send its URL in your ChatGPT conversation. With a connected GitHub account that has permission to that repository, ChatGPT can make requested edits and commits for you.

## When you request edits

Ask for the exact feature or design update and say: "Update LiveStat on GitHub." GitHub changes only when a push/commit actually succeeds; they are not automatically synchronized merely by discussing a change in chat. Once a hosting platform is connected to the repository, you can optionally configure it to redeploy after each push.

## Security

Never commit the `.env` file, runtime data, session secrets, VAPID keys, or other tokens. `.gitignore` is already configured to keep these out of Git. The `data` directory contains a placeholder file only.

## CI

`.github/workflows/tests.yml` runs automated tests on pushes and pull requests.
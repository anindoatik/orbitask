# Orbitask — Deploy to GitHub Pages

A modern task management app with boards, groups, reminders, and calendar export.

---

## Deploy (All Done on GitHub's Website)

### Step 1: Create Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it **orbitask** (must match this exact name)
3. Set to **Private** if you want your code hidden
4. Click **Create repository**

### Step 2: Upload Files

1. On the new repo page, click the **"uploading an existing file"** link
2. Unzip the downloaded `.zip` file
3. Drag and drop **all files and folders** from inside the `orbitask-gh` folder onto the upload area
4. Click **Commit changes**

> **Important:** Upload the *contents* of the folder (not the folder itself). You should see files like `package.json`, `index.html`, `src/`, `.github/` in the root of your repo.

### Step 3: Enable GitHub Pages

1. In your repo, go to **Settings** → **Pages** (in the left sidebar)
2. Under **Source**, select **GitHub Actions**
3. That's it — the workflow will run automatically

### Step 4: Visit Your Site

After ~1 minute, your app will be live at:

```
https://YOUR_USERNAME.github.io/orbitask/
```

You can find the exact URL in **Settings → Pages** or in the **Actions** tab after the build completes.

---

## Updating the App

Any time you push changes to the `main` branch, GitHub Actions will automatically rebuild and redeploy.

---

## Using a Different Repo Name

If you name your repo something other than `orbitask`, update the `base` value in `vite.config.js` to match:

```js
base: "/your-repo-name/",
```

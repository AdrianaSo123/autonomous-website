# Autonomous AI Portfolio & Blog

A fully autonomous, zero-maintenance personal portfolio and blog system. The frontend is a static web app hosted on GitHub Pages, while the backend logic uses AI to automatically generate and publish content. 

There are no databases and no heavy frontend frameworks—just pure Vanilla HTML/JS, GitHub-native automation, and OpenAI integration.

## Features

- **Static Vanilla Frontend**: Fast, dependency-free frontend using HTML, CSS, and minimal vanilla JavaScript. No React, Next.js, or Vue.
- **Client-Side Markdown Blog**: A dynamic front-end pipeline that loads and renders Markdown files (`posts/*.md`) seamlessly without a backend router.
- **Voice-to-Blog Automation Server**: A lightweight Node.js Express server (`server/uploadServer.js`) that accepts audio recordings, transcribes them using OpenAI Whisper, formats them into a Markdown post using GPT-4o, and directly commits them to this GitHub repository.
- **Headless CMS via JSON**: Portfolio content is sourced from a single `content.json` file.
- **AI-Driven UI Updates**: Trigger portfolio updates simply by providing a text instruction via a GitHub Actions workflow, which uses OpenAI to rewrite `content.json` against a strict JSON schema (`schema.json`).

---

## Architecture Details

### The Frontend (Static Site)
- `index.html`, `blog.html`, `works.html`, `services.html`, `contact.html`: The core pages of the site.
- `post.html`: Dynamically fetches and renders individual Markdown blog posts based on the requested URL.
- Uses `posts/index.json` to fetch the list of available posts to render in the blog sections.

### The Backend (Audio-to-Post Server)
Located in the `server/` directory, this Node/Express service allows on-the-fly blog publishing:
1. **Transcribe**: Converts a multipart form audio upload to text using OpenAI Whisper.
2. **Format**: Uses GPT-4o to transform the transcript into a well-structured Markdown blog post with accurate YAML frontmatter.
3. **Publish**: Appends the new `.md` file directly to the GitHub repository's `posts/` folder using the GitHub REST API. This triggers GitHub Pages to effortlessly update the live site.

### The AI Portfolio Updater (GitHub Actions)
- **`scripts/update.js`**: Node.js script responsible for applying AI-driven modifications to `content.json` without breaking the site structure.
- **`.github/workflows/update-site.yml`**: A GitHub Action that runs the above script based on a user prompt, and handles committing/pushing the changes back to the `main` branch.

---

## Setup Instructions

### 1. Prerequisites
- Node.js uploaded locally.
- An OpenAI API Key (`OPENAI_API_KEY`).
- A GitHub Personal Access Token (`GITHUB_TOKEN`) with `repo` permissions to allow the automation server to write to this repository.

### 2. Running the Audio-to-Blog Server Locally
```bash
cd server
npm install
```
Create a `.env` file inside the `server/` directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO=yourusername/autonomous-website
PORT=3000
```
Start the server:
```bash
node uploadServer.js
```

### 3. Triggering UI Updates via GitHub Actions
To update your portfolio info via the Actions tab:
1. Add `OPENAI_API_KEY` to your repository **Settings > Secrets and variables > Actions**.
2. Go to the **Actions** tab in this repository.
3. Select the **Update Portfolio Site** workflow and click **Run workflow**.
4. Pass a command like `"Add a new project explaining my recent voice-to-blog tool"`.

---

*(Future Goal: Integrating client-side Google Authentication using Google Identity Services.)*

# Autonomous GitHub-Native AI Portfolio

A fully autonomous, zero-maintenance portfolio system that deploys on GitHub Pages and updates via GitHub Actions using structured AI output with strict schema validation. No backend, no databases, just pure GitHub-native automation.

## Features
- **Headless CMS via JSON**: All content is sourced from a single `content.json` file.
- **Strict Schema Validation**: A robust JSON schema (`schema.json`) guarantees the AI cannot break the UI.
- **Automated Updates**: Trigger website updates simply by providing a text instruction.
- **No Dependencies**: Frontend is purely HTML/Vanilla JS with a minimal minimalist/brutalist design. 

---

## Setup Instructions

### 1. Fork the Repository
Click the "Fork" button in the top right corner of this repository to create your own copy.

### 2. Add Your OpenAI API Key
We use OpenAI's API to intelligently parse your instructions and rewrite the `content.json` securely.
1. Go to your repository **Settings**.
2. Navigate to **Secrets and variables** > **Actions** in the left sidebar.
3. Click **New repository secret**.
4. Set the name to `OPENAI_API_KEY`.
5. Paste your OpenAI API key in the Secret field and save.

### 3. Enable GitHub Pages
1. Go to repository **Settings**.
2. Navigate to **Pages** in the left sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Set the branch to `main` and the folder to `/` (root).
5. Click **Save**. Within a few minutes, your portfolio will be live!

---

## Usage: Trigger Updates

You can update your portfolio in two ways without ever editing HTML or JSON manually.

### Option 1: Via GitHub Actions UI
1. Go to the **Actions** tab in your repository.
2. Select **Update Portfolio Site** from the left sidebar.
3. Click **Run workflow**.
4. Enter your instruction (e.g., `"Change my tagline to 'Full Stack AI Dev'"` or `"Add a new project about an AI discord bot"`).
5. Run the workflow. Once completed, your live site will update.

### Option 2: Via GitHub CLI (Terminal)
The fastest way for developers to update their portfolio:
```bash
gh workflow run update-site.yml -f instruction="Add a new AI workflow consulting service"
```

---

## Architecture details

- **`content.json`**: Acts as the data layer. 
- **`schema.json`**: Strict definitions of required keys. Rejecting any extra unexpected keys to enforce deterministic UI rendering.
- **`scripts/update.js`**: Node.js script responsible for:
  - Calling the OpenAI API with the User Instruction + Current State + Schema.
  - Enforcing JSON-only output using `gpt-4o` and `response_format`.
  - Validating the output using `ajv`.
  - Discarding changes completely (non-zero exit) if validation fails.
- **`.github/workflows/update-site.yml`**: Triggers the script and handles committing/pushing back to the `main` branch.

**Security**: 
- `OPENAI_API_KEY` is never logged or exposed in frontend code. 
- No persistent PAT/access tokens are stored. The automated commit leverages the secure, ephemeral `github-actions[bot]`.

const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const matter = require('gray-matter');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure Multer for processing multipart/form-data audio uploads
const upload = multer({ dest: 'uploads/' });

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper variables for GitHub API
const githubToken = process.env.GITHUB_TOKEN;
const githubRepoUrl = process.env.GITHUB_REPO; // format: owner/repo

// Ensure the posts directory exists
const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_INDEX = path.join(POSTS_DIR, 'index.json');

// Ensure we have correct paths and index.json
if (!fs.existsSync(POSTS_DIR)) {
    console.error('The posts directory does not exist! Please ensure the server is run in the autonomous-website/server directory.');
    process.exit(1);
}

// Ensure the index.json exists.
if (!fs.existsSync(POSTS_INDEX)) {
    fs.writeFileSync(POSTS_INDEX, '[]', 'utf8');
}

/**
 * Pushes a new commit to the main branch via the GitHub API
 */
async function commitToGitHub(markdownObj, indexObj) {
    if (!githubToken || !githubRepoUrl) {
        throw new Error('Missing GitHub credentials (GITHUB_TOKEN, GITHUB_REPO)');
    }

    const apiUrl = `https://api.github.com/repos/${githubRepoUrl}`;
    const headers = {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };

    // 1. Get the latest commit SHA of the main branch
    const refRes = await fetch(`${apiUrl}/git/refs/heads/main`, { headers });
    if (!refRes.ok) throw new Error(`Failed to get ref: ${refRes.statusText}`);
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree SHA of the latest commit
    const commitRes = await fetch(`${apiUrl}/git/commits/${latestCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error(`Failed to get commit: ${commitRes.statusText}`);
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blob for markdown file
    const mdBlobRes = await fetch(`${apiUrl}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content: markdownObj.content,
            encoding: 'utf-8'
        })
    });
    if (!mdBlobRes.ok) throw new Error(`Failed to create markdown blob: ${mdBlobRes.statusText}`);
    const mdBlobData = await mdBlobRes.json();

    // 4. Create blob for index.json
    const indexBlobRes = await fetch(`${apiUrl}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            content: indexObj.content,
            encoding: 'utf-8'
        })
    });
    if (!indexBlobRes.ok) throw new Error(`Failed to create index blob: ${indexBlobRes.statusText}`);
    const indexBlobData = await indexBlobRes.json();

    // 5. Create a new tree containing our blobs
    const treeRes = await fetch(`${apiUrl}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: [
                {
                    path: `posts/${markdownObj.slug}.md`,
                    mode: '100644', // 100644 is standard file mode
                    type: 'blob',
                    sha: mdBlobData.sha
                },
                {
                    path: 'posts/index.json',
                    mode: '100644',
                    type: 'blob',
                    sha: indexBlobData.sha
                }
            ]
        })
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${(await treeRes.text())}`);
    const treeData = await treeRes.json();

    // 6. Create a new commit
    const newCommitRes = await fetch(`${apiUrl}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            message: `Autopublish post: ${markdownObj.title}`,
            tree: treeData.sha,
            parents: [latestCommitSha]
        })
    });
    if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${newCommitRes.statusText}`);
    const newCommitData = await newCommitRes.json();

    // 7. Update the branch reference
    const updateRefRes = await fetch(`${apiUrl}/git/refs/heads/main`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            sha: newCommitData.sha,
            force: false
        })
    });
    if (!updateRefRes.ok) throw new Error(`Failed to update branch ref: ${updateRefRes.statusText}`);

    return newCommitData.html_url;
}

/**
 * Handle POST /upload
 */
app.post('/upload', upload.single('audio'), async (req, res) => {
    let uploadedFilePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided in the request.' });
        }

        uploadedFilePath = req.file.path;

        // Multer removes extensions; OpenAI requires an extension to infer the format
        const originalExt = path.extname(req.file.originalname) || '.m4a';
        const newFilePath = uploadedFilePath + originalExt;
        fs.renameSync(uploadedFilePath, newFilePath);
        uploadedFilePath = newFilePath;

        console.log(`Received audio upload. Transcribing...`);

        // 1. Transcribe the audio using OpenAI Whisper
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(uploadedFilePath),
            model: 'whisper-1',
        });

        const transcriptText = transcription.text.trim();
        console.log(`Original Transcript: "${transcriptText}"`);

        if (transcriptText.length < 15) {
            console.warn("Transcript too short, ignoring as hallucination/noise.");
            return res.status(400).json({ error: "Audio was too short or did not contain clear speech." });
        }

        console.log('Transcription completed. Generating blog post...');

        // 2. Format the text into a blog post using GPT
        // Generate the date deterministically
        const todayDate = new Date().toISOString().split('T')[0];

        const prompt = `
You are an expert blog writer, journalist, and content formatter.
I have a raw audio transcript from a mobile recording. It could be about a technical topic, a random idea, a journal entry, or a personal update.

**CRITICAL INSTRUCTIONS:**
1. If the transcript is very clearly just background noise, silent, or a known auto-generated hallucination with no coherent intent (e.g. "Thanks for watching", "MBC News"), return exactly and ONLY the string 'ERROR: NO_CONTENT'. Otherwise, proceed.
2. Correct any obvious transcription errors, phonetic misspellings, or grammar issues while maintaining the original meaning.
3. Transform this transcript into a completely structured, excellent, and cohesive blog post.
4. The blog post must strictly follow this exact markdown format, including the frontmatter dash separators exactly as shown:

---
title: "The Perfect Post Title"
tags: ["tag1", "tag2"]
---

Markdown body text here. Make it readable, use headers if appropriate, and maintain the original message.

Constraints:
- Respond *only* with the raw markdown string. Do not wrap it in markdown block ticks like \`\`\`markdown.
- Do NOT generate \`date\` or \`slug\` inside the frontmatter. I will handle those automatically.

Raw Transcript:
"${transcriptText}"
`;

        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o', // or gpt-4-turbo
            messages: [
                { role: 'system', content: 'You are a blog automation system that strictly returns the requested format. Correct any spelling or transcription issues.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
        });

        const generatedContentRaw = chatCompletion.choices[0].message.content.trim();

        if (generatedContentRaw === 'ERROR: NO_CONTENT') {
            console.warn("LLM identified transcript as noise or hallucination. Aborting.");
            return res.status(400).json({ error: "Transcript did not contain enough meaningful content to generate a blog." });
        }

        // 3. Extract Metadata from the generated markdown using gray-matter
        const parsed = matter(generatedContentRaw);
        const metadata = parsed.data;
        const contentBody = parsed.content.trim();

        if (!metadata.title || !metadata.tags) {
            throw new Error('Missing required title or tags in the generated markdown frontmatter. Raw output: ' + generatedContentRaw);
        }

        // Apply deterministic date and slug
        metadata.date = todayDate;

        function generateSlug(title, date) {
            return (
                date +
                '-' +
                title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
            );
        }

        metadata.slug = generateSlug(metadata.title, metadata.date);

        console.log(`Blog post generated deterministically with slug: ${metadata.slug}`);

        // Reconstruct the markdown frontmatter so the actual file holds the correct date and slug
        const newFrontmatter = `---
title: ${metadata.title}
date: ${metadata.date}
slug: ${metadata.slug}
tags: ${JSON.stringify(metadata.tags)}
---`;

        const generatedContent = `${newFrontmatter}\n\n${contentBody}\n`;

        // 4. Update the local file system (so that the server is in sync, though we will push to github via api)
        const newMarkdownPath = path.join(POSTS_DIR, `${metadata.slug}.md`);
        fs.writeFileSync(newMarkdownPath, generatedContent, 'utf8');

        // Update local index.json
        const currentIndex = JSON.parse(fs.readFileSync(POSTS_INDEX, 'utf8'));
        currentIndex.push({
            title: metadata.title,
            slug: metadata.slug,
            date: metadata.date,
            tags: metadata.tags
        });

        // Ensure we sort by date descending just to keep it clean (though frontend might handle it)
        currentIndex.sort((a, b) => new Date(b.date) - new Date(a.date));

        const newIndexContent = JSON.stringify(currentIndex, null, 2);
        fs.writeFileSync(POSTS_INDEX, newIndexContent, 'utf8');

        console.log(`Local files updated. Committing to GitHub...`);

        // 5. Commit these changes via the GitHub Content API
        if (githubToken && githubRepoUrl) {
            await commitToGitHub(
                { title: metadata.title, slug: metadata.slug, content: generatedContent },
                { content: newIndexContent }
            );
            console.log('Successfully committed to GitHub!');
        } else {
            console.warn('Skipping GitHub commit as credentials were not provided in .env');
        }

        // 6. Return success
        return res.status(200).json({
            success: true,
            post: metadata
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        // Always try to clean up the temporary Multer file
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
        }
    }
});

app.listen(port, () => {
    console.log(`Automation server is running on http://localhost:${port}`);
});

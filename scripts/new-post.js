const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Core paths
const POSTS_DIR = path.join(__dirname, '../posts');
const INDEX_JSON_PATH = path.join(POSTS_DIR, 'index.json');
const SCHEMA_PATH = path.join(__dirname, '../posts-schema.json');

// Configuration
const apiKey = process.env.OPENAI_API_KEY;
const instruction = process.argv[2];

// Fail Hard
function abort(message) {
    console.error(`\n❌ FATAL: ${message}`);
    console.error("Aborting process. No files were modified.");
    process.exit(1);
}

// 1. Initial Checks
if (!instruction) abort("No instruction provided. Please provide a topic or draft.");
if (!apiKey) abort("OPENAI_API_KEY environment variable is missing.");
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

// 2. Load dependencies safely
let schema, indexData;
try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

    if (fs.existsSync(INDEX_JSON_PATH)) {
        indexData = JSON.parse(fs.readFileSync(INDEX_JSON_PATH, 'utf8'));
        if (!Array.isArray(indexData)) throw new Error("index.json is not an array");
    } else {
        indexData = [];
    }
} catch (e) {
    abort(`Dependency load failed: ${e.message}`);
}

// 3. Prompt Construction
const promptDate = new Date().toISOString().split('T')[0]; // Current YYYY-MM-DD
const prompt = `
Generate a blog post based on the following instruction.
Instruction: "${instruction}"

You must output valid JSON perfectly matching this schema:
${JSON.stringify(schema, null, 2)}

Rules:
1. "date" must be exactly "${promptDate}".
2. "slug" MUST start with "${promptDate}-" followed by lowercase, kebab-case words mirroring the title.
3. Keep the tone modern, strategic, and concise.
4. "body" should be formatted in Markdown, but properly escaped for JSON.
5. Do not include any text outside the JSON object.
`;

// 4. Execution Pipeline
async function runPipeline() {
    console.log(`🚀 Starting post generation pipeline...`);

    // --- Phase 1: Generation ---
    let rawOutput;
    try {
        console.log("🤖 Requesting generation from OpenAI...");
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            abort(`API Request Failed: ${response.status} ${response.statusText}\n${errBody}`);
        }

        const data = await response.json();
        rawOutput = data.choices[0].message.content;
    } catch (e) {
        abort(`LLM network failure: ${e.message}`);
    }

    // --- Phase 2: Parsing & Validation ---
    console.log("📦 Validating LLM Output...");
    let postData;
    try {
        postData = JSON.parse(rawOutput);
    } catch (e) {
        abort(`Failed to parse AI output as JSON. Raw output:\n${rawOutput}`);
    }

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    if (!validate(postData)) {
        console.error("Schema Violation Details:");
        validate.errors.forEach(err => console.error(`  - ${err.instancePath} ${err.message}`));
        abort("Output failed structural validation against posts-schema.json");
    }

    // --- Phase 3: Programmatic Constraints & Collision Integrity ---
    const targetFilename = `${postData.slug}.md`;
    const targetFilePath = path.join(POSTS_DIR, targetFilename);

    console.log(`🔒 Applying strict programmatic checks to: "${postData.slug}"`);

    // Strict Date/Slug verification
    if (postData.date !== promptDate) {
        abort(`Date mismatch: LLM generated "${postData.date}" but today is "${promptDate}"`);
    }
    if (!postData.slug.startsWith(promptDate + '-')) {
        abort(`Slug structure violation: "${postData.slug}" does not start with "${promptDate}-"`);
    }

    if (indexData.some(p => p.slug === postData.slug)) {
        abort(`Slug collision: "${postData.slug}" already exists in index.json`);
    }
    if (fs.existsSync(targetFilePath)) {
        abort(`File collision: "${targetFilename}" already exists on disk`);
    }

    // --- Phase 4: Deterministic Markdown Formatting ---
    console.log("🏗️ Formatting deterministic Markdown...");
    const tagsArrayStr = JSON.stringify(postData.tags);

    const markdownContent = `---
title: ${postData.title}
date: ${postData.date}
slug: ${postData.slug}
tags: ${tagsArrayStr}
---

${postData.body}
`;

    // --- Phase 5: Atomic Writes ---
    console.log("💾 Executing atomic writes...");

    // Temp paths
    const tempMarkdownPath = targetFilePath + '.tmp';
    const tempIndexPath = INDEX_JSON_PATH + '.tmp';

    try {
        // Prepare new index.json state
        const newIndexEntry = {
            title: postData.title,
            date: postData.date,
            slug: postData.slug,
            tags: postData.tags
        };
        const newIndexData = [...indexData, newIndexEntry];

        // Validate the entire new index structure before doing *any* I/O
        const indexSchemaPath = path.join(__dirname, '../posts-index-schema.json');
        const indexSchema = JSON.parse(fs.readFileSync(indexSchemaPath, 'utf8'));
        const validateIndex = ajv.compile(indexSchema);

        if (!validateIndex(newIndexData)) {
            console.error("Index Schema Violation Details:");
            validateIndex.errors.forEach(err => console.error(`  - ${err.instancePath} ${err.message}`));
            abort("Generated index array failed structural validation against posts-index-schema.json");
        }

        // 1. Write the temporary files
        fs.writeFileSync(tempMarkdownPath, markdownContent, 'utf8');
        fs.writeFileSync(tempIndexPath, JSON.stringify(newIndexData, null, 2) + '\n', 'utf8');

        // 2. Pivot to final paths atomically
        fs.renameSync(tempMarkdownPath, targetFilePath);
        fs.renameSync(tempIndexPath, INDEX_JSON_PATH);

    } catch (e) {
        // Cleanup block
        if (fs.existsSync(tempMarkdownPath)) fs.unlinkSync(tempMarkdownPath);
        if (fs.existsSync(tempIndexPath)) fs.unlinkSync(tempIndexPath);
        abort(`CRITICAL IO FAILURE during write phase: ${e.message}. Temporary files purged.`);
    }

    console.log("✨ Post successfully generated and integrated safely.");
}

runPipeline();

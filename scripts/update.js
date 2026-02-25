const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Paths
const CONTENT_PATH = path.join(__dirname, '../content.json');
const SCHEMA_PATH = path.join(__dirname, '../schema.json');

// Get arguments & credentials
const instruction = process.argv[2];
const apiKey = process.env.OPENAI_API_KEY;

if (!instruction) {
    console.error("❌ Error: No instruction provided.");
    process.exit(1);
}

if (!apiKey) {
    console.error("❌ Error: OPENAI_API_KEY environment variable is missing.");
    process.exit(1);
}

// Load current files
let currentContent;
let schema;
try {
    currentContent = fs.readFileSync(CONTENT_PATH, 'utf8');
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (error) {
    console.error(`❌ Error reading files: ${error.message}`);
    process.exit(1);
}

// Core Functions
function validateContent(contentObj) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(contentObj);

    if (!valid) {
        console.error("❌ Schema Validation Failed:");
        validate.errors.forEach(err => {
            console.error(`  - ${err.instancePath} ${err.message}`);
        });
        return false;
    }
    return true;
}

function getPromptContent(instruction, content, schemaDef) {
    return `
You are an expert AI agent maintaining a strict JSON-based headless CMS for a portfolio site.

Current content.json:
${content}

Schema required:
${JSON.stringify(schemaDef, null, 2)}

User Instruction: 
"${instruction}"

Update the JSON based on the User Instruction. 
IMPORTANT RULES:
1. Output ONLY valid JSON.
2. Adhere STRICTLY to the schema.
3. Keep the tone sharp, modern, and consultant-level. Focus on strategic intelligence and systems thinking.
4. No extra keys, no missing required keys (including philosophy and selected_works).
5. No text before or after the JSON.
`;
}

async function fetchLLMUpdate(prompt, key) {
    console.log("🤖 Requesting update from OpenAI...");
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API Request Failed: ${response.status} ${response.statusText}\n${errBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

function parseAndValidate(rawOutput) {
    console.log("📦 Parsing AI Output...");
    let newContent;
    try {
        newContent = JSON.parse(rawOutput);
    } catch (e) {
        throw new Error(`Failed to parse AI output as JSON. Raw output:\n${rawOutput}`);
    }

    console.log("🔍 Validating Output against Schema...");
    if (!validateContent(newContent)) {
        throw new Error("Update rejected due to schema violations.");
    }
    return newContent;
}

function saveUpdatedContent(newContent) {
    console.log("✅ Validation passed. Overwriting content.json...");
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(newContent, null, 2) + '\n');
    console.log("✨ Update complete!");
}

// Main orchestration
async function updatePortfolio() {
    console.log(`🚀 Starting update with instruction: "${instruction}"`);
    console.log("---------------------------------------------------");

    try {
        const prompt = getPromptContent(instruction, currentContent, schema);
        const rawOutput = await fetchLLMUpdate(prompt, apiKey);
        const newContent = parseAndValidate(rawOutput);
        saveUpdatedContent(newContent);
    } catch (error) {
        console.error(`❌ Unexpected Error: ${error.message}`);
        process.exit(1);
    }
}

updatePortfolio();

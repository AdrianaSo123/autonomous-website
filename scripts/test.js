const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const SCHEMA_PATH = path.join(__dirname, '../schema.json');
const CONTENT_PATH = path.join(__dirname, '../content.json');

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const currentContent = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));

function validateContent(contentObj) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(contentObj);

    if (!valid) {
        return false;
    }
    return true;
}

function assertValid(testName, contentObj) {
    if (validateContent(contentObj)) {
        console.log(`✅ Passed: ${testName}`);
    } else {
        console.log(`❌ Failed: ${testName} (it should have passed)`);
    }
}

function assertInvalid(testName, contentObj, reason) {
    if (!validateContent(contentObj)) {
        console.log(`✅ Passed: ${testName} (validation successfully rejected ${reason})`);
    } else {
        console.log(`❌ Failed: ${testName} (validation missed ${reason}!)`);
    }
}

console.log("=== Running Verification Tests ===");

// Test 1: Valid Content
assertValid("Current content.json", currentContent);

// Test 2: Invalid Content (Extra Key)
const invalidContentExtra = { ...currentContent, rogue_key: "I should not exist" };
assertInvalid("Content with extra rogue key", invalidContentExtra, "extra key");

// Test 3: Invalid Content (Missing required section)
const invalidContentMissing = { ...currentContent };
delete invalidContentMissing.services;
assertInvalid("Content with missing required section", invalidContentMissing, "missing key");

console.log("\n=== Outputting index.html load test output ===");
const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
if (htmlContent.includes('<section id="philosophy-section" class="fade-in">')) {
    console.log("✅ index.html structure verified");
} else {
    console.log("❌ index.html structure failed");
}

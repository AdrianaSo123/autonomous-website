const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
    const filePath = './dummy.wav';

    const form = new FormData();
    form.append('audio', fs.createReadStream(filePath), { filename: 'dummy.wav', contentType: 'audio/wav' });

    console.log('Sending POST /upload to http://localhost:3000/upload ...');

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: form,
            // DO NOT set the Content-Type header manually when using form-data; 
            // the library sets it automatically including the boundary string.
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        // Clean up the dummy file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

testUpload();

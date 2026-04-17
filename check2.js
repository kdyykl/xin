const fs = require('fs');
const html = fs.readFileSync('success.html', 'utf8');
const lines = html.split('\n');
lines.forEach((line, i) => {
    if (line.includes('appendChild') || line.includes('starRotator') || line.includes('starField') || line.includes('star-field')) {
        console.log((i+1) + ': ' + line.trim());
    }
});
console.log('\nTotal lines:', lines.length);
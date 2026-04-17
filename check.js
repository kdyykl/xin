const fs = require('fs');
const html = fs.readFileSync('success.html', 'utf8');

// Container CSS
const container = html.match(/\.star-sky \{[\s\S]*?\}/)?.[0] || '';
console.log('=== STAR SKY CSS ===');
console.log(container);

// Star positioning
const vxLine = html.match(/const vx = [^;]+;/)?.[0] || '';
const vyLine = html.match(/const vy = [^;]+;/)?.[0] || '';
const pxLine = html.match(/const px = [^;]+;/)?.[0] || '';
const pyLine = html.match(/const py = [^;]+;/)?.[0] || '';
console.log('\n=== STAR POSITIONING ===');
console.log(vxLine);
console.log(vyLine);
console.log(pxLine);
console.log(pyLine);

// transform-origin
console.log('\n=== TRANSFORM ORIGIN ===');
console.log(html.match(/transform-origin[^;]*/)?.[0] || 'NOT FOUND');

// Animation
console.log('\n=== ANIMATION ===');
console.log(html.match(/@keyframes skyRotate[\s\S]*?\}/)?.[0] || 'NOT FOUND');

// Twinkle keyframe
console.log('\n=== TWINKLE KEYFRAME ===');
console.log(html.match(/@keyframes twinkle[\s\S]*?\}/)?.[0] || 'NOT FOUND');

// Star count
const starStartMatch = html.match(/todayStarIndex = Math\.floor\([^)]+\)/);
console.log('\n=== STAR COUNT FORMULA ===');
console.log(starStartMatch?.[0] || 'NOT FOUND');

// Extra stars
const extraMatch = html.match(/extraStars = (\d+)/);
console.log('extraStars:', extraMatch?.[1] || 'NOT FOUND');
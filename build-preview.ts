/**
 * Build a standalone preview HTML with all sample JSONs embedded.
 * Run: npx tsx build-preview.ts
 * Output: public/preview-standalone.html
 */
import fs from 'fs';
import path from 'path';

const SAMPLES_DIR = path.resolve(__dirname, 'output/samples');
const OUTPUT = path.resolve(__dirname, 'public/preview-standalone.html');

const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.json')).sort();

const embedded: Record<string, any> = {};
for (const file of files) {
  const name = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  embedded[name] = data;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Animation Samples Preview (Standalone)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 16px; }
  h1 { font-size: 18px; margin-bottom: 16px; color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 16px; text-align: center; transition: border-color 0.2s; }
  .card:hover { border-color: #fff; }
  .card .lottie-box { width: 100px; height: 100px; margin: 0 auto 8px; }
  .card .icon-name { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 2px; }
  .card .anim-type { font-size: 11px; color: #7c8aff; }
  .card .status { font-size: 10px; color: #555; margin-top: 4px; }
</style>
</head>
<body>
<h1>Sample Animations (Standalone - No Server Needed)</h1>
<div class="grid" id="grid"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<script>
const ALL_DATA = ${JSON.stringify(embedded)};

const grid = document.getElementById('grid');
const names = Object.keys(ALL_DATA);

names.forEach(name => {
  let iconName, animType;
  if (name.includes('-slide-in')) { iconName = name.replace(/-slide-in$/, ''); animType = 'slide-in'; }
  else if (name.includes('-fade-in')) { iconName = name.replace(/-fade-in$/, ''); animType = 'fade-in'; }
  else { const p = name.split('-'); animType = p.pop(); iconName = p.join('-'); }

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<div class="lottie-box" id="l-' + name + '"></div>'
    + '<div class="icon-name">' + iconName + '</div>'
    + '<div class="anim-type">' + animType + '</div>'
    + '<div class="status" id="s-' + name + '"></div>';
  grid.appendChild(card);

  try {
    const anim = lottie.loadAnimation({
      container: document.getElementById('l-' + name),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: ALL_DATA[name]
    });
    anim.addEventListener('DOMLoaded', () => {
      document.getElementById('s-' + name).textContent = '';
    });
  } catch (e) {
    document.getElementById('s-' + name).textContent = 'Error: ' + e.message;
  }
});
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT, html, 'utf-8');
console.log('Built: ' + OUTPUT);
console.log('Samples embedded: ' + files.length);

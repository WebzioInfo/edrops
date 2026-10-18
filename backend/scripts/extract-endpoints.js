const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(walk(fullPath));
    else if (file.endsWith('.controller.ts')) results.push(fullPath);
  });
  return results;
}

const files = walk('./src');
let totalEndpoints = 0;
const report = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const ctrlMatch = content.match(/@Controller\((?:['"]([^'"]*)['"])?\)/);
  const baseRoute = ctrlMatch ? (ctrlMatch[1] || '') : '';
  const ctrlRoles = content.match(/@Roles\(([^)]+)\)/);
  const ctrlGuards = content.match(/@UseGuards\(([^)]+)\)/);

  const lines = content.split('\n');
  let currentDecorators = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('@')) {
      currentDecorators.push(line);
    }
    const methodMatch = line.match(/^@(Get|Post|Put|Patch|Delete)\((?:['"]([^'"]*)['"])?\)/);
    if (methodMatch) {
      const httpMethod = methodMatch[1].toUpperCase();
      const subRoute = methodMatch[2] || '';
      const fullRoute = '/' + [baseRoute, subRoute].map(s => s.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
      
      // Look ahead for method signature
      let signature = '';
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].includes('(') && !lines[j].trim().startsWith('@')) {
          signature = lines[j].trim();
          break;
        }
      }

      const allDecs = currentDecorators.join(' ');
      const localRoles = allDecs.match(/@Roles\(([^)]+)\)/);
      const localGuards = allDecs.match(/@UseGuards\(([^)]+)\)/);
      const isPublic = allDecs.includes('@Public(') || allDecs.includes('@Public()');
      const localPerms = allDecs.match(/@RequirePermissions\(([^)]+)\)/);

      report.push({
        file: f.replace(/\\/g, '/'),
        httpMethod,
        fullRoute,
        signature,
        roles: localRoles ? localRoles[1].trim() : (ctrlRoles ? ctrlRoles[1].trim() : 'NONE'),
        guards: localGuards ? localGuards[1].trim() : (ctrlGuards ? ctrlGuards[1].trim() : 'NONE'),
        perms: localPerms ? localPerms[1].trim() : 'NONE',
        isPublic
      });
      totalEndpoints++;
      currentDecorators = [];
    } else if (!line.startsWith('@')) {
      currentDecorators = [];
    }
  }
});

console.log('Total Endpoints found:', totalEndpoints);
fs.writeFileSync('all-endpoints.json', JSON.stringify(report, null, 2));
console.log('Saved to all-endpoints.json');

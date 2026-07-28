const fs = require('fs');
const path = require('path');

const BACKEND_SRC = path.join(__dirname, '../backend/src');
const FRONTEND_SRC = path.join(__dirname, '../frontend/src');

function walkDir(dir, ext, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, ext, callback);
    } else if (dirPath.endsWith(ext)) {
      callback(path.join(dirPath));
    }
  });
}

function parseBackend() {
  const endpoints = [];
  walkDir(BACKEND_SRC, '.controller.ts', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract base controller path
    const controllerMatch = content.match(/@Controller\(['"]([^'"]+)['"]\)/);
    const basePath = controllerMatch ? controllerMatch[1] : '';

    // Extract methods
    const methodRegex = /@(Get|Post|Put|Patch|Delete)\(['"]([^'"]*)['"]\)/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const httpMethod = match[1].toUpperCase();
      const subPath = match[2];
      
      let fullPath = `/${basePath}`;
      if (subPath) fullPath += `/${subPath}`;
      // Clean up multiple slashes
      fullPath = fullPath.replace(/\/+/g, '/');
      // Normalize path params like /:id
      fullPath = fullPath.replace(/:[^\/]+/g, '{param}');

      endpoints.push({
        method: httpMethod,
        path: fullPath,
        file: filePath.split('backend/src/')[1]
      });
    }
  });
  return endpoints;
}

function parseFrontend() {
  const calls = [];
  walkDir(FRONTEND_SRC, '.tsx', (filePath) => parseFileForApiCalls(filePath, calls));
  walkDir(FRONTEND_SRC, '.ts', (filePath) => parseFileForApiCalls(filePath, calls));
  return calls;
}

function parseFileForApiCalls(filePath, calls) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Look for fetchWithAuth('/path'...) or fetch('/path'...) or axios.get('/path'...)
  // Simple regex for string literals starting with /
  const fetchRegex = /(?:fetchWithAuth|fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*['"](\/[^'"]+)['"]/g;
  let match;
  while ((match = fetchRegex.exec(content)) !== null) {
    let rawPath = match[1];
    
    // Normalize path params in template literals if any (though regex above only catches pure strings)
    let fullPath = rawPath.replace(/\$\{[^}]+\}/g, '{param}');
    fullPath = fullPath.replace(/\/+/g, '/');

    // Default method to GET unless we can infer it, but for a robust check we just record the path
    calls.push({
      path: fullPath,
      file: filePath.split('frontend/src/')[1]
    });
  }

  // Also look for template literals like fetchWithAuth(`/path/${id}`)
  const templateRegex = /(?:fetchWithAuth|fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*`(\/[^`]+)`/g;
  while ((match = templateRegex.exec(content)) !== null) {
    let rawPath = match[1];
    let fullPath = rawPath.replace(/\$\{[^}]+\}/g, '{param}');
    fullPath = fullPath.replace(/\/+/g, '/');

    calls.push({
      path: fullPath,
      file: filePath.split('frontend/src/')[1]
    });
  }
}

function generateReport() {
  console.log('Scanning Backend...');
  const backendAPIs = parseBackend();
  console.log(`Found ${backendAPIs.length} backend endpoints.`);

  console.log('Scanning Frontend...');
  const frontendAPIs = parseFrontend();
  console.log(`Found ${frontendAPIs.length} frontend API calls.`);

  const backendPaths = new Set(backendAPIs.map(api => api.path));
  const frontendPaths = new Set(frontendAPIs.map(api => api.path));

  const missingInBackend = [];
  const unusedInFrontend = [];

  frontendAPIs.forEach(f => {
    if (!backendPaths.has(f.path)) missingInBackend.push(f);
  });

  backendAPIs.forEach(b => {
    if (!frontendPaths.has(b.path)) unusedInFrontend.push(b);
  });

  let report = `# API Synchronization Audit Report\n\n`;
  
  report += `## Summary\n`;
  report += `- Backend Endpoints Discovered: ${backendAPIs.length}\n`;
  report += `- Frontend API Calls Discovered: ${frontendAPIs.length}\n`;
  report += `- Mismatches / Missing in Backend: ${missingInBackend.length}\n`;
  report += `- Unused Backend APIs: ${unusedInFrontend.length}\n\n`;

  report += `## ⚠️ Frontend Calls Missing in Backend (404 Risks)\n`;
  if (missingInBackend.length === 0) report += `No missing backend endpoints found.\n`;
  else {
    missingInBackend.forEach(m => {
      report += `- **${m.path}** (Found in \`${m.file}\`)\n`;
    });
  }

  report += `\n## ℹ️ Backend APIs Unused by Frontend\n`;
  if (unusedInFrontend.length === 0) report += `No unused backend endpoints found.\n`;
  else {
    unusedInFrontend.forEach(u => {
      report += `- **${u.method}** ${u.path} (Found in \`${u.file}\`)\n`;
    });
  }

  // Deduplicate for cleaner report
  
  fs.writeFileSync(path.join(__dirname, '../sync_report.md'), report);
  console.log('Report generated at sync_report.md');
}

generateReport();

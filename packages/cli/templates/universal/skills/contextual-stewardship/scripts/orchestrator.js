#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const arg1 = process.argv[2];
const arg2 = process.argv[3];

if (!arg1) {
  console.error("Error: Missing argument.");
  console.error("Usage:");
  console.error("  Retrieve: node orchestrator.js retrieve <query>");
  console.error("  Save:     node orchestrator.js '<toon_content>'");
  process.exit(1);
}

// Detect command type: "retrieve" as first argument triggers search mode
if (arg1 === 'retrieve' && arg2) {
  retrieveContext(arg2);
} else if (arg1 === 'retrieve') {
  // retrieve without query - show error
  console.error("Error: Missing query after 'retrieve'.");
  console.error("Usage: node orchestrator.js retrieve <query>");
  process.exit(1);
} else if (arg1.startsWith('retrieve ')) {
  // Handle "retrieve <query>" as single argument
  const query = arg1.slice('retrieve '.length).trim();
  if (query) {
    retrieveContext(query);
  } else {
    console.error("Error: Missing query after 'retrieve'.");
    process.exit(1);
  }
} else {
  saveContext(arg1);
}

function retrieveContext(query) {
  const toonPath = path.join(os.homedir(), '.agents', 'stewardship.toon');

  try {
    if (!fs.existsSync(toonPath)) {
      console.log("No entries found.");
      process.exit(0);
    }

    const content = fs.readFileSync(toonPath, 'utf-8');
    const entries = parseTOON(content);

    // Filter entries matching query
    const matched = entries.filter(entry => {
      if (['arquitetura', 'negocio', 'fluxo_trabalho'].includes(query.toLowerCase())) {
        return entry.domain.toLowerCase() === query.toLowerCase();
      }
      const searchLower = query.toLowerCase();
      return entry.domain.toLowerCase().includes(searchLower) ||
             entry.content.toLowerCase().includes(searchLower);
    });

    if (matched.length === 0) {
      console.log("No matching entries found.");
      process.exit(0);
    }

    // Group by domain
    const grouped = {};
    for (const entry of matched) {
      if (!grouped[entry.domain]) {
        grouped[entry.domain] = [];
      }
      grouped[entry.domain].push(entry.content);
    }

    // Output formatted by domain
    for (const [domain, items] of Object.entries(grouped)) {
      console.log(`\n=== ${domain.toUpperCase()} ===`);
      for (const item of items) {
        console.log(`  - ${item}`);
      }
    }
    console.log();

    process.exit(0);
  } catch (e) {
    console.error("ERROR: Falha ao recuperar contexto.");
    console.error(e.message);
    process.exit(1);
  }
}

function saveContext(content) {
  try {
    const agentDir = path.join(os.homedir(), '.agents');

    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    const toonPath = path.join(agentDir, 'stewardship.toon');

    fs.appendFileSync(toonPath, `\n${content}\n`);

    console.log(`SUCCESS: Contexto salvo em: ${toonPath}`);
    process.exit(0);
  } catch (e) {
    console.error("ERROR: Falha de I/O. Não foi possível salvar o contexto.");
    console.error(e.message);
    process.exit(1);
  }
}

function parseTOON(content) {
  const entries = [];
  const lines = content.split('\n');

  let currentDomain = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for domain header
    const domainMatch = trimmed.match(/^(arquitetura|negocio|fluxo_trabalho):\s*$/i);
    if (domainMatch) {
      currentDomain = domainMatch[1].toLowerCase();
      continue;
    }

    // Check for array entries like "backend,Priorizar Node.js..." (with optional leading whitespace)
    const entryMatch = trimmed.match(/^[a-zA-Z0-9_-]+,(.+)$/);
    if (entryMatch && currentDomain) {
      entries.push({
        domain: currentDomain,
        content: entryMatch[1].trim()
      });
    }
  }

  return entries;
}

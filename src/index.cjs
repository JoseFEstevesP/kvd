#!/usr/bin/env node

// CommonJS wrapper for the ES module entry point
// This is needed for pkg to work properly with ES modules

async function runESM() {
  try {
    // Use dynamic import to load the ES module
    const { default: importActual } = await import('./cli.js');
    return importActual;
  } catch (error) {
    // If direct loading fails, run the main function manually
    await import('./cli.js');
  }
}

runESM().catch(err => {
  console.error('Error running application:', err);
  process.exit(1);
});
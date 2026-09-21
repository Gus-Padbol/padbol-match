process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const { resolveClientEnvironment } = require('../src/config/clientEnvironment.js');
const raw = require('react-scripts/config/env')('').raw;
try {
  const { variant } = resolveClientEnvironment(raw);
  console.log(`Build environment checked: ${variant}.`);
} catch (error) {
  console.error(`Build blocked: ${error.message}`);
  process.exitCode = 1;
}

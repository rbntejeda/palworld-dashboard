const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const projectRoot = path.join(__dirname, '..', '..');
const prismaBinary = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);
const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');

async function runPrismaMigrations(databaseUrl) {
  if (!databaseUrl) {
    return false;
  }

  await execFileAsync(prismaBinary, ['migrate', 'deploy', '--schema', schemaPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    maxBuffer: 10 * 1024 * 1024
  });

  return true;
}

module.exports = {
  runPrismaMigrations
};

const path = require('node:path');
const { execFile } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const prismaBinary = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL no definido; omitiendo migraciones.');
    return;
  }

  await execPromise(prismaBinary, ['migrate', 'deploy', '--schema', path.join(projectRoot, 'prisma', 'schema.prisma')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    }
  });
}

function execPromise(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, options, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

void main().catch((error) => {
  console.error(`Prisma migrate failed: ${error.message}`);
  process.exit(1);
});

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
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL || 'mysql://user:password@127.0.0.1:3306/palworld_dashboard'
  };

  await execPromise(prismaBinary, ['generate', '--schema', path.join(projectRoot, 'prisma', 'schema.prisma')], {
    cwd: projectRoot,
    env
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
  console.error(`Prisma generate failed: ${error.message}`);
  process.exit(1);
});

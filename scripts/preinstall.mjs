import { unlinkSync, existsSync } from 'fs';

for (const f of ['package-lock.json', 'yarn.lock']) {
  if (existsSync(f)) {
    unlinkSync(f);
    console.log(`Removed ${f}`);
  }
}

const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error('Error: Use pnpm to install dependencies in this repo.');
  process.exit(1);
}

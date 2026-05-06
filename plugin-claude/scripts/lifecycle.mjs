/**
 * Thin entrypoint for lifecycle hooks → core/runtime/lifecycle.mjs.
 */

import { handleSessionStart, handleSessionEnd } from '../../core/runtime/lifecycle.mjs';

const [,, action, ...rest] = process.argv;
const envFile = rest.find((a) => a.startsWith('--env-file='))?.split('=')[1];

if (action === 'start') {
  handleSessionStart({ envFile })
    .then(({ sessionId, endpoint }) => {
      console.log(JSON.stringify({ sessionId, endpoint }));
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
} else if (action === 'end') {
  handleSessionEnd({ envFile })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
} else {
  console.error('Usage: lifecycle.mjs <start|end> [--env-file=...]');
  process.exit(1);
}

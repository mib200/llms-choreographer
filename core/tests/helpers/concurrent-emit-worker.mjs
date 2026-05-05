// Worker-thread emitter used by the observability concurrent-rotation race test.
// Each worker loads core/observability.mjs with the shared CHOREO_LOG_DIR and
// low CHOREO_LOG_MAX_BYTES so every worker trips the cap simultaneously. Node
// ESM caches modules per worker isolate, so each worker's rotatedThisProcess
// flag starts false and each emit takes the full rotate + cap-check path.
import { workerData } from 'node:worker_threads';

process.env.CHOREO_LOG_DIR = workerData.logDir;
process.env.CHOREO_LOG_MAX_BYTES = String(workerData.cap);

const { emit } = await import('../../observability.mjs');
emit({ type: 'concurrent', id: workerData.id });

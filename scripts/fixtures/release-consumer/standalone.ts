import { rehearse } from './lifecycle.js';
import { startFire } from './quickstart.js';

void rehearse((target, host) => ({ effect: startFire(target, host) }));

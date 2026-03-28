import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

const worker = setupWorker(...handlers);

export function startWorker() {
  if (typeof window === 'undefined') return;
  // avoid duplicate start
  // @ts-expect-error flag
  if (window.__MSW_RUNNING__) return;
  // @ts-expect-error flag
  window.__MSW_RUNNING__ = true;
  worker.start({ quiet: true });
}

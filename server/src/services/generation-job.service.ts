import { JobStoreService } from './job-store.service';
import { JobRunnerService } from './job-runner.service';

export type { ImageGenerationParams } from './job-store.service';

/**
 * Generation Job Service — facade that composes JobStoreService (DB CRUD)
 * and JobRunnerService (execution + lifecycle) behind a single surface.
 *
 * Route consumers import this class unchanged; the split is purely internal.
 */
export class GenerationJobService {
  private store: JobStoreService;
  private runner: JobRunnerService;

  // ── Store delegation ─────────────────────────────────────────────────────
  listJobs: JobStoreService['listJobs'];
  getJob: JobStoreService['getJob'];
  updateJob: JobStoreService['updateJob'];
  updateQueuePositions: JobStoreService['updateQueuePositions'];

  // ── Runner delegation ────────────────────────────────────────────────────
  createJob: JobRunnerService['createJob'];
  cancelJob: JobRunnerService['cancelJob'];
  retryJob: JobRunnerService['retryJob'];

  constructor() {
    this.store = new JobStoreService();
    this.runner = new JobRunnerService(this.store);

    this.listJobs = this.store.listJobs.bind(this.store);
    this.getJob = this.store.getJob.bind(this.store);
    this.updateJob = this.store.updateJob.bind(this.store);
    this.updateQueuePositions = this.store.updateQueuePositions.bind(this.store);

    this.createJob = this.runner.createJob.bind(this.runner);
    this.cancelJob = this.runner.cancelJob.bind(this.runner);
    this.retryJob = this.runner.retryJob.bind(this.runner);
  }
}

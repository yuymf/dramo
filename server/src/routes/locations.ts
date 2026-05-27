import { createAssetRouter } from '../lib/asset-route-factory';
import { LocationAssetService } from '../services/location-asset.service';

const locationAssetService = new LocationAssetService();

export const locations = createAssetRouter({
  model: 'location',
  service: locationAssetService,
  agentWorkflow: 'locationsworkflow',
  basePath: '/projects/:projectId/locations',
});

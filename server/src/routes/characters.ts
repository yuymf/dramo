import { createAssetRouter } from '../lib/asset-route-factory';
import { CharacterAssetService } from '../services/character-asset.service';

const characterAssetService = new CharacterAssetService();

export const characters = createAssetRouter({
  model: 'character',
  service: characterAssetService,
  agentWorkflow: 'charactersworkflow',
  basePath: '/projects/:projectId/characters',
});

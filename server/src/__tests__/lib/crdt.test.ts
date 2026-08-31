import { describe, expect, it } from '@jest/globals';
import { applyCrdt, encodeCrdt, mergeNodesIntoCrdt, nodesToYDoc, yDocToNodes } from '../../lib/crdt';

describe('CRDT nodes', () => {
  it('round-trips screenplay nodes', () => {
    const nodes = [
      { id: 'a', type: 'scene_heading' as const, text: 'INT. TRAIN - NIGHT' },
      { id: 'b', type: 'dialogue' as const, text: 'Last train.' },
    ];
    const doc = nodesToYDoc(nodes);
    expect(yDocToNodes(doc)).toEqual(nodes);
    const encoded = encodeCrdt(doc);
    const next = nodesToYDoc([]);
    applyCrdt(next, encoded);
    expect(yDocToNodes(next)).toEqual(nodes);
  });

  it('rebuilds when nodes change', () => {
    const first = mergeNodesIntoCrdt('', [{ id: '1', type: 'action', text: '一' }]);
    const second = mergeNodesIntoCrdt(first, [{ id: '1', type: 'action', text: '二' }]);
    const doc = nodesToYDoc([]);
    applyCrdt(doc, second);
    expect(yDocToNodes(doc)[0]?.text).toBe('二');
  });
});

import { describe, expect, it } from '@jest/globals';
import { fdxToNodes, nodesToFdx } from '../../lib/fdx';

describe('fdx', () => {
  it('round-trips scene and dialogue', () => {
    const xml = nodesToFdx(
      [
        { id: '1', type: 'scene_heading', text: 'INT. TRAIN - NIGHT' },
        { id: '2', type: 'character', text: 'LIN' },
        { id: '3', type: 'dialogue', text: 'Last train.' },
      ],
      'Demo'
    );
    expect(xml).toContain('FinalDraft');
    const parsed = fdxToNodes(xml);
    expect(parsed.nodes.map((node) => node.type)).toEqual(['scene_heading', 'character', 'dialogue']);
    expect(parsed.nodes[0].text).toBe('INT. TRAIN - NIGHT');
    expect(parsed.title).toBe('Demo');
  });
});

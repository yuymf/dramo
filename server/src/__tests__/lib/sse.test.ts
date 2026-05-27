describe('createAgentOSStream', () => {
  it('is exported from sse.ts', async () => {
    const { createAgentOSStream } = await import('../../lib/sse');
    expect(typeof createAgentOSStream).toBe('function');
  });

  it('throws TypeError when endpoint is missing', async () => {
    const { createAgentOSStream } = await import('../../lib/sse');
    await expect(
      // @ts-expect-error intentionally passing empty opts
      createAgentOSStream({} as unknown, {})
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('throws TypeError when payload is missing', async () => {
    const { createAgentOSStream } = await import('../../lib/sse');
    await expect(
      // @ts-expect-error intentionally passing opts without payload
      createAgentOSStream({} as unknown, { endpoint: 'testworkflow' })
    ).rejects.toBeInstanceOf(TypeError);
  });
});

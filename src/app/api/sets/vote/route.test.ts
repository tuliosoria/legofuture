import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/curated-sets', () => ({
  hasVoted: vi.fn(),
  recordVote: vi.fn(),
}));
vi.mock('@/lib/db/rate-limit', () => ({
  enforceIpRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

import { POST } from './route';
import * as db from '@/lib/db/curated-sets';
import * as rl from '@/lib/db/rate-limit';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/sets/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/sets/vote', () => {
  it('returns 400 when setNumber is missing', async () => {
    vi.mocked(rl.enforceIpRateLimit).mockResolvedValue(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 409 when IP has already voted', async () => {
    vi.mocked(rl.enforceIpRateLimit).mockResolvedValue(null);
    vi.mocked(db.hasVoted).mockResolvedValue(true);
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(409);
  });

  it('returns 200 and new vote count on success', async () => {
    vi.mocked(rl.enforceIpRateLimit).mockResolvedValue(null);
    vi.mocked(db.hasVoted).mockResolvedValue(false);
    vi.mocked(db.recordVote).mockResolvedValue(42);
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.voteCount).toBe(42);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(rl.enforceIpRateLimit).mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    );
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(429);
  });
});

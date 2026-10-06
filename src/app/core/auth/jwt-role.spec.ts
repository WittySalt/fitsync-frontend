import { normalizeRole, roleFromAccessToken, subjectFromAccessToken } from './jwt-role';

function fakeJwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

describe('jwt-role', () => {
  it('normalises the role text', () => {
    expect(normalizeRole('ADMIN')).toBe('ADMIN');
    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole('USER')).toBe('USER');
    expect(normalizeRole('COACH')).toBe('USER');
  });

  it('keeps a missing role unknown', () => {
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole('  ')).toBeNull();
    expect(normalizeRole(7)).toBeNull();
  });

  it('reads the role claim of a signed jwt', () => {
    expect(roleFromAccessToken(fakeJwt({ role: 'ADMIN' }))).toBe('ADMIN');
    expect(roleFromAccessToken(fakeJwt({ role: 'USER' }))).toBe('USER');
  });

  it('returns null for a jwt without a role or a malformed jwt', () => {
    expect(roleFromAccessToken(fakeJwt({ sub: 'u1' }))).toBeNull();
    expect(roleFromAccessToken(null)).toBeNull();
    expect(roleFromAccessToken('not-a-jwt')).toBeNull();
    expect(roleFromAccessToken('a.%%%.c')).toBeNull();
    expect(roleFromAccessToken(`a.${btoa('"text"')}.c`)).toBeNull();
  });
});

describe('subjectFromAccessToken', () => {
  const tokenWith = (claims: object): string => ['header', btoa(JSON.stringify(claims)), 'signature'].join('.');

  it('reads the subject of a token', () => {
    expect(subjectFromAccessToken(tokenWith({ sub: 'person-1' }))).toBe('person-1');
  });

  it('gives null for a missing, malformed or subject-less token', () => {
    expect(subjectFromAccessToken(null)).toBeNull();
    expect(subjectFromAccessToken('nonsense')).toBeNull();
    expect(subjectFromAccessToken(tokenWith({ role: 'USER' }))).toBeNull();
    expect(subjectFromAccessToken(tokenWith({ sub: '  ' }))).toBeNull();
  });
});


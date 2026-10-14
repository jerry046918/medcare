import { describe, it, expect } from 'vitest';
import reducer, { handleAuthExpired } from '../slices/authSlice';

describe('authSlice', () => {
  const initial = {
    user: { id: 1, username: 'a', role: 'admin' },
    token: 't', selfMember: { id: 9, name: 'A' },
    isAuthenticated: true, isLoading: false, needsSetup: false, error: null, logoutReason: null
  };
  it('handleAuthExpired 清空并记录原因', () => {
    const s = reducer(initial, handleAuthExpired());
    expect(s.isAuthenticated).toBe(false);
    expect(s.logoutReason).toBe('token_expired');
    expect(s.user).toBeNull();
    expect(s.selfMember).toBeNull();
  });
});

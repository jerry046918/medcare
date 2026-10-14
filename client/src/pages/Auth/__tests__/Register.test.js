import { describe, it, expect } from 'vitest';
import { resolveBindOptions, buildRegisterPayload } from '../registerFormLogic';

describe('resolveBindOptions', () => {
  it('专属码 → 只能认领指定成员', () => {
    const r = resolveBindOptions({ boundMember: { id: 1, name: '爸' } });
    expect(r.canClaim).toBe(true);
    expect(r.canCreate).toBe(false);
    expect(r.boundMember).toEqual({ id: 1, name: '爸' });
    expect(r.claimable).toEqual([{ id: 1, name: '爸' }]);
  });
  it('通用码且有可认领 → 两种模式', () => {
    const r = resolveBindOptions({ claimableMembers: [{ id: 2 }] });
    expect(r.canCreate).toBe(true);
    expect(r.canClaim).toBe(true);
    expect(r.boundMember).toBeNull();
    expect(r.claimable).toEqual([{ id: 2 }]);
  });
  it('通用码且无可认领 → 只能新建', () => {
    const r = resolveBindOptions({ claimableMembers: [] });
    expect(r.canClaim).toBe(false);
    expect(r.canCreate).toBe(true);
  });
  it('needsSetup(无预检结果) → 只能新建', () => {
    const r = resolveBindOptions(null);
    expect(r).toEqual({ canCreate: true, canClaim: false, boundMember: null, claimable: [] });
  });
});

describe('buildRegisterPayload', () => {
  it('needsSetup 时不带邀请码', () => {
    const p = buildRegisterPayload({ username: 'a', password: '123456', inviteCode: 'X',
      mode: 'create', newMember: { name: 'A', gender: '男' }, needsSetup: true });
    expect(p.inviteCode).toBeUndefined();
    expect(p.memberData).toEqual({ name: 'A', gender: '男' });
    expect(p.claimMemberId).toBeUndefined();
  });

  it('create 模式只带 memberData', () => {
    const p = buildRegisterPayload({ username: 'a', password: '123456', inviteCode: 'X',
      mode: 'create', newMember: { name: 'A', gender: '女', birthday: '2000-01-01' },
      claimMemberId: 9, needsSetup: false });
    expect(p.inviteCode).toBe('X');
    expect(p.mode).toBe('create');
    expect(p.memberData).toEqual({ name: 'A', gender: '女', birthday: '2000-01-01' });
    expect(p.claimMemberId).toBeUndefined();
  });

  it('claim 模式只带 claimMemberId', () => {
    const p = buildRegisterPayload({ username: 'a', password: '123456', inviteCode: 'X',
      mode: 'claim', newMember: { name: 'A', gender: '男' }, claimMemberId: 7, needsSetup: false });
    expect(p.mode).toBe('claim');
    expect(p.memberData).toBeUndefined();
    expect(p.claimMemberId).toBe(7);
  });
});

// 注册两步向导的纯逻辑（不含 React），便于单测：
// - resolveBindOptions：根据 previewInvite 预检结果决定第二步可用的绑定模式
// - buildRegisterPayload：按 mode 组装注册请求体（与后端 register 契约一一对应）

// 根据预检结果决定第二步的可用模式
// preview 为 null（needsSetup 首账户跳过预检）→ 只能新建
export function resolveBindOptions(preview) {
  if (!preview) return { canCreate: true, canClaim: false, boundMember: null, claimable: [] };
  if (preview.boundMember) {
    // 专属码：只能认领码所绑定的成员
    return {
      canCreate: false,
      canClaim: true,
      boundMember: preview.boundMember,
      claimable: [preview.boundMember]
    };
  }
  // 通用码：可新建；有未被绑定的成员时可认领
  const claimable = preview.claimableMembers || [];
  return { canCreate: true, canClaim: claimable.length > 0, boundMember: null, claimable };
}

// 组装注册请求体：
// - needsSetup（首账户）不带邀请码
// - mode=create 只带 memberData；mode=claim 只带 claimMemberId
export function buildRegisterPayload({
  username, password, inviteCode, mode, newMember, claimMemberId, needsSetup
}) {
  return {
    username,
    password,
    inviteCode: needsSetup ? undefined : inviteCode,
    mode,
    memberData: mode === 'create' ? newMember : undefined,
    claimMemberId: mode === 'claim' ? claimMemberId : undefined
  };
}

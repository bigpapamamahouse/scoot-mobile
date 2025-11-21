import { apiFetch } from './apiFetch';

export const ModerationAPI = {
  // Block a user
  async blockUser(userId: string): Promise<{ success: boolean; blocked: boolean }> {
    return apiFetch('/block', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Unblock a user
  async unblockUser(userId: string): Promise<{ success: boolean; blocked: boolean }> {
    return apiFetch('/unblock', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Get list of blocked users
  async getBlockedUsers(): Promise<{
    items: Array<{
      userId: string;
      handle: string | null;
      fullName: string | null;
      avatarKey: string | null;
    }>;
  }> {
    return apiFetch('/blocked');
  },

  // Report content
  async reportContent(params: {
    contentType: 'post' | 'comment';
    contentId: string;
    reason: string;
  }): Promise<{ success: boolean; reportId: string }> {
    return apiFetch('/report', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Check if there's a block between two users
  async isBlocked(userId: string): Promise<{ blocked: boolean }> {
    return apiFetch(`/is-blocked?userId=${userId}`);
  },

  // Admin: Get all reports
  async getReports(status: 'pending' | 'resolved' = 'pending'): Promise<{
    items: Array<any>;
  }> {
    return apiFetch(`/reports?status=${status}`);
  },

  // Admin: Take action on a report
  async takeAction(
    reportId: string,
    action: 'delete_content' | 'ban_user' | 'dismiss'
  ): Promise<{ success: boolean; action: string }> {
    return apiFetch(`/reports/${reportId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },
};

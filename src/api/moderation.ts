import { api } from './client';

export const ModerationAPI = {
  // Block a user
  async blockUser(userId: string): Promise<{ success: boolean; blocked: boolean }> {
    return api('/block', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Unblock a user
  async unblockUser(userId: string): Promise<{ success: boolean; blocked: boolean }> {
    return api('/unblock', {
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
    return api('/blocked');
  },

  // Report content
  async reportContent(params: {
    contentType: 'post' | 'comment';
    contentId: string;
    reason: string;
  }): Promise<{ success: boolean; reportId: string }> {
    return api('/report', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Check if there's a block between two users
  async isBlocked(userId: string): Promise<{ blocked: boolean }> {
    return api(`/is-blocked?userId=${userId}`);
  },

  // Admin: Get all reports
  async getReports(status: 'pending' | 'resolved' = 'pending'): Promise<{
    items: Array<any>;
  }> {
    return api(`/reports?status=${status}`);
  },

  // Admin: Take action on a report
  async takeAction(
    reportId: string,
    action: 'delete_content' | 'ban_user' | 'dismiss'
  ): Promise<{ success: boolean; action: string }> {
    return api(`/reports/${reportId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },
};

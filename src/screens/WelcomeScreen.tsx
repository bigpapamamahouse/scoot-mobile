import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UsersAPI, InvitesAPI } from '../api';
import { readStoredInviteCode, writeStoredInviteCode } from '../lib/storage';
import { useTheme } from '../theme';
import { Avatar } from '../components/Avatar';
import type { User } from '../types';

interface SuggestedUser extends User {
  isInviter?: boolean;
}

export default function WelcomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [inviteCode, setInviteCode] = React.useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = React.useState<SuggestedUser[]>([]);
  const [followingState, setFollowingState] = React.useState<Record<string, 'none' | 'pending' | 'following'>>({});
  const [followLoading, setFollowLoading] = React.useState<Record<string, boolean>>({});

  // Load invite code
  const loadInviteCode = React.useCallback(async () => {
    try {
      const data = await UsersAPI.me();
      const normalizedId =
        data && typeof (data as any).id === 'string' && (data as any).id.trim().length
          ? (data as any).id.trim()
          : null;
      let normalizedInviteCode =
        data && typeof (data as any).inviteCode === 'string' && (data as any).inviteCode.trim().length
          ? (data as any).inviteCode.trim()
          : null;

      if (!normalizedInviteCode && normalizedId) {
        normalizedInviteCode = await readStoredInviteCode(normalizedId);
      }

      if (!normalizedInviteCode) {
        // Try to create a new invite code
        try {
          if (InvitesAPI.listInvites) {
            const existing = await InvitesAPI.listInvites();
            const existingCode = UsersAPI.findInviteCode?.(existing) ?? null;
            if (existingCode) {
              normalizedInviteCode = existingCode;
            }
          }
        } catch {
          // Silently continue
        }

        if (!normalizedInviteCode) {
          try {
            const payload = await InvitesAPI.createInvite(10);
            normalizedInviteCode = UsersAPI.findInviteCode?.(payload) ?? null;
          } catch {
            // Silently continue - invite code not critical for welcome screen
          }
        }
      }

      setInviteCode(normalizedInviteCode);

      if (normalizedInviteCode && normalizedId) {
        await writeStoredInviteCode(normalizedId, normalizedInviteCode);
      }
    } catch (error) {
      console.error('Failed to load invite code:', error);
    }
  }, []);

  // Load suggested users
  const loadSuggestedUsers = React.useCallback(async () => {
    try {
      const suggestions = await UsersAPI.getWelcomeSuggestions(5);
      setSuggestedUsers(suggestions as SuggestedUser[]);

      // Initialize following state to 'none' for all
      const initialState: Record<string, 'none' | 'pending' | 'following'> = {};
      suggestions.forEach((user) => {
        if (user.handle) {
          initialState[user.handle] = 'none';
        }
      });
      setFollowingState(initialState);
    } catch (error) {
      console.error('Failed to load suggested users:', error);
    }
  }, []);

  // Load data on mount
  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadInviteCode(), loadSuggestedUsers()]);
      setLoading(false);
    };
    loadData();
  }, [loadInviteCode, loadSuggestedUsers]);

  const handleFollow = async (handle: string) => {
    if (followLoading[handle]) return;

    setFollowLoading((prev) => ({ ...prev, [handle]: true }));

    try {
      const result = await UsersAPI.followUser(handle);
      const status = result?.status || 'following';
      setFollowingState((prev) => ({
        ...prev,
        [handle]: status === 'pending' ? 'pending' : 'following',
      }));
    } catch (error: any) {
      console.error('Failed to follow user:', error);
      Alert.alert('Error', 'Failed to follow user. Please try again.');
    } finally {
      setFollowLoading((prev) => ({ ...prev, [handle]: false }));
    }
  };

  const handleShare = async () => {
    if (!inviteCode) {
      Alert.alert('No invite code', 'Your invite code is not available yet.');
      return;
    }

    try {
      const message = `Join me on Scoot! Use my invite code: ${inviteCode}`;
      await Share.share({
        message,
        ...(Platform.OS === 'ios' && { url: 'https://apps.apple.com/us/app/scoot-social/id6755162428' }),
      });
    } catch (error) {
      console.error('Error sharing invite code:', error);
      Alert.alert('Error', 'Failed to share invite code. Please try again.');
    }
  };

  const handleContinue = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          Setting up your experience...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.primary }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Welcome Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary[100] }]}>
            <Ionicons name="sparkles" size={48} color={colors.primary[500]} />
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Welcome to Scoot!</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Find someone to follow or invite new friends to join!
          </Text>
        </View>

        {/* Suggested Users */}
        {suggestedUsers.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              People to follow
            </Text>
            <View style={[styles.usersContainer, { backgroundColor: colors.background.elevated }]}>
              {suggestedUsers.map((user) => (
                <View
                  key={user.id || user.handle}
                  style={[
                    styles.userRow,
                    { borderBottomColor: colors.border.light },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => navigation.navigate('Profile', { handle: user.handle })}
                    activeOpacity={0.7}
                  >
                    <Avatar avatarKey={user.avatarKey} size={48} />
                    <View style={styles.userText}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.userName, { color: colors.text.primary }]} numberOfLines={1}>
                          {user.fullName || user.handle}
                        </Text>
                        {user.isInviter && (
                          <View style={[styles.inviterBadge, { backgroundColor: colors.primary[100] }]}>
                            <Text style={[styles.inviterBadgeText, { color: colors.primary[600] }]}>
                              Invited you
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.userHandle, { color: colors.text.secondary }]} numberOfLines={1}>
                        @{user.handle}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      followingState[user.handle || ''] === 'none'
                        ? { backgroundColor: colors.primary[500] }
                        : { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.main },
                    ]}
                    onPress={() => user.handle && handleFollow(user.handle)}
                    disabled={followLoading[user.handle || ''] || followingState[user.handle || ''] !== 'none'}
                    activeOpacity={0.7}
                  >
                    {followLoading[user.handle || ''] ? (
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    ) : (
                      <Text
                        style={[
                          styles.followButtonText,
                          followingState[user.handle || ''] === 'none'
                            ? { color: '#fff' }
                            : { color: colors.text.secondary },
                        ]}
                      >
                        {followingState[user.handle || ''] === 'none'
                          ? 'Follow'
                          : followingState[user.handle || ''] === 'pending'
                          ? 'Pending'
                          : 'Following'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Invite Friends Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Invite friends
          </Text>
          <View style={[styles.inviteContainer, { backgroundColor: colors.background.elevated }]}>
            <Text style={[styles.inviteDescription, { color: colors.text.secondary }]}>
              Scoot is more fun with friends! Share your invite code:
            </Text>

            {inviteCode ? (
              <>
                <View
                  style={[
                    styles.inviteCodeBox,
                    {
                      backgroundColor: colors.background.secondary,
                      borderColor: colors.primary[300],
                    },
                  ]}
                >
                  <Text selectable style={[styles.inviteCodeText, { color: colors.text.primary }]}>
                    {inviteCode}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.shareButton, { backgroundColor: colors.primary[500] }]}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={18} color="#fff" style={styles.shareIcon} />
                  <Text style={styles.shareButtonText}>Share Invite Code</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.inviteCodeText, { color: colors.text.tertiary }]}>
                Generating your invite code...
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.footer, { backgroundColor: colors.background.primary, borderTopColor: colors.border.light }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.primary[500] }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue to Feed</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.continueIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  container: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  usersContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  userText: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 14,
    marginTop: 2,
  },
  inviterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inviterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inviteContainer: {
    borderRadius: 16,
    padding: 16,
  },
  inviteDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  inviteCodeBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inviteCodeText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  shareIcon: {
    marginRight: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  continueIcon: {
    marginLeft: 8,
  },
});

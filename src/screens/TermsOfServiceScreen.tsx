import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useCurrentUser } from '../contexts/CurrentUserContext';
import { api } from '../api/client';

export default function TermsOfServiceScreen({ navigation, route }: any) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useCurrentUser();
  const isNewUser = route?.params?.isNewUser === true;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await api('/me/accept-terms', {
        method: 'POST',
      });
      await refreshUser();
      // Navigate to Welcome for new users, Feed for existing users
      navigation.replace(isNewUser ? 'Welcome' : 'Feed');
    } catch (error) {
      console.error('Error accepting terms:', error);
      alert('Failed to accept terms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Please read and accept our terms to continue</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.text}>
          By accessing and using this application, you accept and agree to be bound by the terms
          and provision of this agreement.
        </Text>

        <Text style={styles.sectionTitle}>2. Zero Tolerance for Objectionable Content</Text>
        <Text style={styles.text}>
          We maintain a strict zero-tolerance policy for objectionable content and abusive users.
          The following types of content are strictly prohibited:
        </Text>
        <Text style={styles.bulletText}>• Pornographic or sexually explicit content</Text>
        <Text style={styles.bulletText}>• Graphic violence, gore, or disturbing imagery</Text>
        <Text style={styles.bulletText}>• Hate speech or discrimination based on race, religion, gender, sexual orientation, or disability</Text>
        <Text style={styles.bulletText}>• Harassment, bullying, or threats toward other users</Text>
        <Text style={styles.bulletText}>• Spam, scams, or fraudulent content</Text>
        <Text style={styles.bulletText}>• Illegal activities or promotion of dangerous behavior</Text>
        <Text style={styles.bulletText}>• Content that infringes on intellectual property rights</Text>

        <Text style={styles.sectionTitle}>3. Content Moderation</Text>
        <Text style={styles.text}>
          All content posted on this platform is subject to automated and manual review. We employ
          AI-powered content moderation to detect and prevent objectionable content. Posts that
          violate our policies will be automatically rejected or removed.
        </Text>

        <Text style={styles.sectionTitle}>4. Reporting Objectionable Content</Text>
        <Text style={styles.text}>
          Users have the ability to report content they find objectionable. We take all reports
          seriously and commit to reviewing and acting on valid reports within 24 hours.
        </Text>

        <Text style={styles.sectionTitle}>5. Blocking and Privacy</Text>
        <Text style={styles.text}>
          You have the right to block any user whose content or behavior you find objectionable.
          Blocked users will not be able to view your content or interact with you on the platform.
        </Text>

        <Text style={styles.sectionTitle}>6. Consequences of Violations</Text>
        <Text style={styles.text}>
          Violations of these terms will result in immediate action, including but not limited to:
        </Text>
        <Text style={styles.bulletText}>• Immediate removal of offending content</Text>
        <Text style={styles.bulletText}>• Temporary or permanent suspension of account</Text>
        <Text style={styles.bulletText}>• Permanent ban from the platform</Text>
        <Text style={styles.bulletText}>• Reporting to appropriate authorities if illegal content is involved</Text>

        <Text style={styles.sectionTitle}>7. User Responsibility</Text>
        <Text style={styles.text}>
          You are responsible for all content you post and actions you take on this platform.
          You agree to use this service in a manner that is legal, respectful, and in accordance
          with these terms.
        </Text>

        <Text style={styles.sectionTitle}>8. Content Monitoring</Text>
        <Text style={styles.text}>
          By using this service, you acknowledge and agree that your posts may be monitored and
          analyzed by automated systems to ensure compliance with our content policies.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
        <Text style={styles.text}>
          We reserve the right to modify these terms at any time. Users will be notified of
          significant changes and may be required to accept updated terms to continue using the
          service.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={styles.text}>
          If you have questions about these terms or wish to report a violation, please contact
          us through the app's reporting features or at our support channels.
        </Text>

        <Text style={[styles.text, styles.lastUpdated]}>
          Last Updated: {new Date().toLocaleDateString()}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the Terms of Service
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, (!agreed || loading) && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={!agreed || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept and Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginLeft: 16,
    marginBottom: 8,
  },
  lastUpdated: {
    marginTop: 24,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#000',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
  },
  acceptButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

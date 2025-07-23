import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface PaymentDetails {
  recipientName: string;
  recipientUsername: string;
  amount: number;
  description: string;
  paymentMethod: 'paypal' | 'venmo';
}

interface PaymentWebViewProps {
  visible: boolean;
  onClose: () => void;
  paymentDetails: PaymentDetails;
  onPaymentComplete?: (success: boolean) => void;
}

const PaymentWebView: React.FC<PaymentWebViewProps> = ({
  visible,
  onClose,
  paymentDetails,
  onPaymentComplete,
}) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Generate payment URLs with pre-filled data
  const generatePaymentUrl = (details: PaymentDetails): string => {
    const { recipientUsername, amount, description, paymentMethod } = details;
    
    if (paymentMethod === 'paypal') {
      // PayPal.me format: https://paypal.me/username/amount
      const baseUrl = `https://paypal.me/${recipientUsername}/${amount.toFixed(2)}`;
      // Add description as note if possible (PayPal has limited support)
      return baseUrl;
    } else {
      // Venmo web format: https://venmo.com/username?amount=XX&note=YY
      const encodedNote = encodeURIComponent(description);
      return `https://venmo.com/${recipientUsername}?amount=${amount.toFixed(2)}&note=${encodedNote}`;
    }
  };

  const paymentUrl = generatePaymentUrl(paymentDetails);

  // Detect payment completion based on URL changes
  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setCanGoBack(navState.canGoBack);
    setLoading(navState.loading);

    console.log('WebView navigation:', {
      url: navState.url,
      title: navState.title,
      loading: navState.loading,
    });

    // Payment completion detection
    if (!paymentCompleted) {
      const url = navState.url.toLowerCase();
      const title = navState.title?.toLowerCase() || '';

      // PayPal completion indicators
      if (paymentDetails.paymentMethod === 'paypal') {
        if (
          url.includes('paypal.com/myaccount/transfer/send/confirm') ||
          url.includes('paypal.com/webapps/mpp/pay-confirm') ||
          title.includes('payment sent') ||
          title.includes('payment complete') ||
          url.includes('/activity') ||
          url.includes('return_url')
        ) {
          handlePaymentComplete(true);
        }
      }

      // Venmo completion indicators
      if (paymentDetails.paymentMethod === 'venmo') {
        if (
          url.includes('venmo.com/account/payment/') ||
          url.includes('venmo.com/account/activity') ||
          title.includes('payment sent') ||
          title.includes('payment complete') ||
          url.includes('/feed') ||
          url.includes('/activity')
        ) {
          handlePaymentComplete(true);
        }
      }
    }
  };

  const handlePaymentComplete = (success: boolean) => {
    if (paymentCompleted) return; // Prevent multiple calls
    
    setPaymentCompleted(true);
    console.log('Payment completion detected:', success);
    
    Alert.alert(
      success ? 'Payment Sent!' : 'Payment Status',
      success 
        ? `Your payment of $${paymentDetails.amount.toFixed(2)} to ${paymentDetails.recipientName} has been sent successfully!`
        : 'Unable to confirm payment completion. Please check your payment app for status.',
      [
        {
          text: 'Done',
          onPress: () => {
            onPaymentComplete?.(success);
            onClose();
          }
        }
      ]
    );
  };

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const handleRefresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleClose = () => {
    if (paymentCompleted) {
      onClose();
      return;
    }

    Alert.alert(
      'Close Payment',
      'Are you sure you want to close? Your payment may not be completed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close', style: 'destructive', onPress: onClose }
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              Pay {paymentDetails.recipientName}
            </Text>
            <Text style={styles.headerSubtitle}>
              ${paymentDetails.amount.toFixed(2)} • {paymentDetails.paymentMethod.toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {canGoBack && (
              <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={20} color="#ffffff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
              <Ionicons name="refresh" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>
              Loading {paymentDetails.paymentMethod === 'paypal' ? 'PayPal' : 'Venmo'}...
            </Text>
          </View>
        )}

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            Alert.alert(
              'Loading Error',
              'Failed to load payment page. Please check your internet connection.',
              [{ text: 'OK' }]
            );
          }}
          // Allow navigation to payment-related domains
          domStorageEnabled={true}
          javaScriptEnabled={true}
          startInLoadingState={true}
          // Security: Only allow navigation to trusted payment domains
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url.toLowerCase();
            const allowedDomains = [
              'paypal.com',
              'paypal.me',
              'venmo.com',
              'login.paypal.com',
              'www.paypal.com',
              'www.venmo.com'
            ];
            
            const isAllowed = allowedDomains.some(domain => url.includes(domain));
            
            if (!isAllowed) {
              console.warn('Blocked navigation to:', request.url);
            }
            
            return isAllowed;
          }}
        />

        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText} numberOfLines={1}>
            {currentUrl || 'Loading...'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 14,
  },
  webview: {
    flex: 1,
  },
  statusBar: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  statusText: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
});

export default PaymentWebView;
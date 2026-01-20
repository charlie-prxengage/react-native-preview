// PRxWidget.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import * as Location from 'expo-location';

// Conditionally import WebView only on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

interface PRxWidgetProps {
  widgetId: string;
  style?: object;
}

const PRxWidget: React.FC<PRxWidgetProps> = ({ widgetId, style }) => {
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState(600);
  const [userLocation, setUserLocation] = useState<{ lat: number; long: number } | null>(null);
  const webViewRef = useRef<any>(null);

  // Request location permissions and get user's location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            lat: location.coords.latitude,
            long: location.coords.longitude,
          });
        }
      } catch (error) {
        console.log('Location permission denied or error:', error);
      }
    })();
  }, []);

  // JavaScript to inject into WebView
  // 1. Intercepts window.open calls and sends them to React Native
  // 2. Intercepts geolocation and uses coordinates passed from React Native
  // 3. Reports height changes
  const getInjectedJavaScript = () => {
    const locationOverride = userLocation
      ? `
        // Override geolocation with native location
        const nativeCoords = { latitude: ${userLocation.lat}, longitude: ${userLocation.long} };

        navigator.geolocation.getCurrentPosition = function(success, error, options) {
          success({
            coords: {
              latitude: nativeCoords.latitude,
              longitude: nativeCoords.longitude,
              accuracy: 100,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
        };
      `
      : '';

    return `
      (function() {
        ${locationOverride}

        // Intercept window.open to open links in native browser
        const originalOpen = window.open;
        window.open = function(url, target, features) {
          if (url && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'external_link',
              url: url
            }));
            return null;
          }
          return originalOpen.call(window, url, target, features);
        };

        // Also intercept link clicks with target="_blank"
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a[target="_blank"]');
          if (link && link.href) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'external_link',
              url: link.href
            }));
          }
        }, true);

        // Report height changes
        function reportHeight() {
          const height = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
          );
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'resize', height }));
          }
        }

        new ResizeObserver(reportHeight).observe(document.body);
        window.addEventListener('load', () => setTimeout(reportHeight, 500));
        setInterval(reportHeight, 1000); // Periodic check for dynamic content

        true;
      })();
    `;
  };

  // HTML template that embeds the widget
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }
      </style>
    </head>
    <body>
      <script type="application/json" data-prxengage-config>{
  "widget_id": "${widgetId}",
  "consent_position": "above-condition",
  "button_background_color": "#233b65",
  "text_accent_color": "#120c0e",
  "max_height_mode": "fill",
  "container_style": "none"
}</script>
      <prxengage-widget></prxengage-widget>
      <script src="https://widget.prxengage.com/widget.js"></script>
    </body>
    </html>
  `;

  // Handle messages from WebView
  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'resize' && data.height) {
        setHeight(data.height);
      }

      if (data.type === 'external_link' && data.url) {
        // Open external links in the device's native browser
        Linking.openURL(data.url).catch((err) => {
          console.error('Failed to open URL:', err);
        });
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  }, []);

  // Handle navigation requests (backup for regular link clicks)
  const handleNavigationRequest = useCallback((request: any) => {
    const url = request.url;

    // Allow initial load and widget resources
    if (
      url === 'about:blank' ||
      url.startsWith('data:') ||
      url.includes('widget.prxengage.com') ||
      url.includes('api.prxengage.com') ||
      url.includes('api-staging.prxengage.com')
    ) {
      return true;
    }

    // External link - open in native browser
    if (url.startsWith('http')) {
      Linking.openURL(url).catch((err) => {
        console.error('Failed to open URL:', err);
      });
      return false;
    }

    return true;
  }, []);

  // Web platform: Use iframe (geolocation works natively in browser)
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <iframe
          srcDoc={html}
          style={{
            width: '100%',
            height: 700,
            border: 'none',
          }}
          title="PRx Widget"
          allow="geolocation"
        />
      </View>
    );
  }

  // Native platforms: Use WebView
  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0891b2" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.webview, { height }]}
        onLoadEnd={() => setLoading(false)}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        injectedJavaScript={getInjectedJavaScript()}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        cacheEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
  },
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export default PRxWidget;

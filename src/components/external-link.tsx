import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export type ExternalLinkProps = TouchableOpacityProps & {
  href: string;
};

export function ExternalLink({ href, ...rest }: ExternalLinkProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        void WebBrowser.openBrowserAsync(href);
      }}
      {...rest}
    />
  );
}

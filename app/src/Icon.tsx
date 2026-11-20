import React from 'react';
import {StyleProp, TextStyle} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {colors} from './theme';

export type IconName =
  | 'home' | 'storefront' | 'receipt' | 'person' | 'search' | 'location' | 'call' | 'document-text'
  | 'checkmark-circle' | 'close-circle' | 'alert-circle' | 'trash' | 'chatbubble' | 'help-circle'
  | 'cart' | 'basket' | 'cash' | 'time' | 'notifications' | 'calendar' | 'stats-chart'
  | 'cloud-offline' | 'mail-open' | 'phone-portrait' | 'construct' | 'bag-check' | 'checkmark' | 'close'
  | 'list' | 'hourglass' | 'happy' | 'create' | 'nutrition' | 'water' | 'leaf' | 'cafe' | 'egg' | 'walk'
  | 'people' | 'ribbon' | 'person-add' | 'card' | 'star' | 'remove-circle' | 'log-out' | 'checkbox' | 'square' | 'chevron-forward' | 'locate';

/**
 * App icon. Outlined by default; pass `filled` for the selected / focused state.
 */
export default function Icon({name, size = 22, color = colors.text, filled = false, style}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={filled ? name : `${name}-outline`} size={size} color={color} style={style} />;
}

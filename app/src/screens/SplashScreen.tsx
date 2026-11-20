import React, {useEffect, useRef} from 'react';
import {ActivityIndicator, Animated, Easing, StatusBar, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {colors} from '../theme';
import Icon, {IconName} from '../Icon';
import Logo from '../Logo';

// Floating icons: position (% of screen), size, how far they drift, speed and phase.
// Different sizes and speeds give a simple depth (parallax) feel.
const FLOATERS = [
  {icon: 'water' as IconName, x: 0.10, y: 0.26, size: 64, drift: 14, ms: 3200, delay: 0},
  {icon: 'basket' as IconName, x: 0.72, y: 0.21, size: 56, drift: 12, ms: 2700, delay: 300},
  {icon: 'nutrition' as IconName, x: 0.80, y: 0.47, size: 62, drift: 14, ms: 3400, delay: 600},
  {icon: 'leaf' as IconName, x: 0.05, y: 0.55, size: 56, drift: 12, ms: 3000, delay: 900},
  {icon: 'egg' as IconName, x: 0.68, y: 0.84, size: 46, drift: 9, ms: 2500, delay: 1200},
];

function Floater({f, w, h}: {f: typeof FLOATERS[number]; w: number; h: number}) {
  const t = useRef(new Animated.Value(0)).current; // 0..1 float cycle
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {toValue: 1, duration: 600, delay: f.delay, useNativeDriver: true}).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(t, {toValue: 1, duration: f.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(t, {toValue: 0, duration: f.ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    ).start();
  }, [t, appear, f]);

  const translateY = t.interpolate({inputRange: [0, 1], outputRange: [f.drift, -f.drift]});
  const translateX = t.interpolate({inputRange: [0, 1], outputRange: [-f.drift / 3, f.drift / 3]});
  const rotate = t.interpolate({inputRange: [0, 1], outputRange: ['-8deg', '8deg']});
  const scale = Animated.multiply(
    appear.interpolate({inputRange: [0, 1], outputRange: [0.3, 1]}),
    t.interpolate({inputRange: [0, 1], outputRange: [0.96, 1.06]}),
  );

  return (
    <Animated.View
      style={[
        s.floater,
        {
          left: f.x * w, top: f.y * h, width: f.size, height: f.size, borderRadius: f.size / 2,
          opacity: appear, transform: [{translateX}, {translateY}, {rotate}, {scale}],
        },
      ]}>
      <Icon name={f.icon} size={f.size * 0.5} color={colors.primaryDark} />
    </Animated.View>
  );
}

export default function SplashScreen() {
  const {width, height} = useWindowDimensions();
  const pop = useRef(new Animated.Value(0.5)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, {toValue: 1, friction: 5, useNativeDriver: true}),
      Animated.timing(fade, {toValue: 1, duration: 700, useNativeDriver: true}),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(bob, {toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    ).start();
  }, [pop, fade, bob]);

  const logoY = bob.interpolate({inputRange: [0, 1], outputRange: [6, -6]});

  return (
    <View style={s.wrap}>
      <StatusBar barStyle="light-content" />
      <View style={s.bubbleA} />
      <View style={s.bubbleB} />

      {FLOATERS.map((f, i) => <Floater key={i} f={f} w={width - 70} h={height - 150} />)}

      <View style={{alignItems: 'center', marginTop: 70}}>
        <Animated.View style={[s.logo, {opacity: fade, transform: [{translateY: logoY}, {scale: pop}]}]}>
          <Logo size={84} color={colors.primary} />
        </Animated.View>
        <Animated.View style={{opacity: fade, alignItems: 'center', marginTop: 28}}>
          <Text style={s.name}>DailyList</Text>
          <Text style={s.tag}>Your everyday shopping, simplified.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[s.loader, {opacity: fade}]}>
        <ActivityIndicator color="#fff" />
        <Text style={s.loaderText}>Finding shops near you…</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  bubbleA: {
    position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#ffffff12',
    top: -120, right: -140,
  },
  bubbleB: {
    position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: '#00000010',
    bottom: -140, left: -120,
  },
  floater: {
    position: 'absolute', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: {width: 0, height: 6}, elevation: 8,
  },
  logo: {
    width: 140, height: 140, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {position: 'absolute', bottom: 70, alignItems: 'center', gap: 10},
  loaderText: {color: '#DDF2EF', fontSize: 12},
  name: {fontSize: 26, fontWeight: '800', color: '#fff'},
  tag: {fontSize: 13, color: '#DDF2EF', marginTop: 6},
});

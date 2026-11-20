import React, {useEffect, useRef, useState} from 'react';
import {
  Animated, Easing, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StatusBar, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../components';
import {useAuth} from '../AuthContext';
import {colors} from '../theme';
import Icon, {IconName} from '../Icon';
import Logo from '../Logo';

type Slide = {key: string; icon: IconName; around: IconName[]; title: string; text: string; tint: string};

const SLIDES: Slide[] = [
  {
    key: 'shops', icon: 'location', around: ['storefront', 'water', 'basket'], tint: '#DDF2EF',
    title: 'Find shops near you',
    text: 'See the registered shops around you, nearest first. Pick the one you like to buy from.',
  },
  {
    key: 'list', icon: 'document-text', around: ['leaf', 'cafe', 'cart'], tint: '#dbeafe',
    title: 'Write your list and send it',
    text: 'Type the items and quantities you need and send them to the shop. No standing in a long queue.',
  },
  {
    key: 'ready', icon: 'checkmark-circle', around: ['bag-check', 'notifications', 'nutrition'], tint: '#fef3c7',
    title: 'The shop checks your order',
    text: 'The shop owner marks items they don\'t have, packs the rest, and tells you when it is ready.',
  },
  {
    key: 'pay', icon: 'cash', around: ['walk', 'basket', 'happy'], tint: '#fce7f3',
    title: 'Pick up and pay at the shop',
    text: 'No online payment needed. Walk in, pick up your packed order, and pay at the counter.',
  },
];

function Illustration({slide}: {slide: Slide}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(t, {toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(t, {toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    ).start();
  }, [t]);

  const up = t.interpolate({inputRange: [0, 1], outputRange: [8, -8]});
  const down = t.interpolate({inputRange: [0, 1], outputRange: [-6, 6]});
  const spots = [
    {left: 14, top: 40, size: 56, move: up},
    {right: 6, top: 70, size: 50, move: down},
    {left: 48, bottom: 14, size: 46, move: up},
  ];

  return (
    <View style={[s.art, {backgroundColor: slide.tint}]}>
      <Animated.View style={[s.hero, {transform: [{translateY: down}]}]}>
        <Icon name={slide.icon} size={80} color={colors.primaryDark} />
      </Animated.View>
      {slide.around.map((e, i) => (
        <Animated.View key={i}
          style={[s.satellite, {
            width: spots[i].size, height: spots[i].size, borderRadius: spots[i].size / 2,
            left: (spots[i] as any).left, right: (spots[i] as any).right,
            top: (spots[i] as any).top, bottom: (spots[i] as any).bottom,
            transform: [{translateY: spots[i].move}],
          }]}>
          <Icon name={e} size={spots[i].size * 0.5} color={colors.primaryDark} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Intro slides shown the first time the app is opened. */
export default function OnboardingScreen() {
  const {finishOnboarding} = useAuth();
  const {width} = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (last) return finishOnboarding();
    listRef.current?.scrollToIndex({index: index + 1, animated: true});
    setIndex(index + 1);
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={s.top}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Logo size={26} color={colors.primary} />
          <Text style={s.brand}>DailyList</Text>
        </View>
        {!last ? <Pressable onPress={finishOnboarding} hitSlop={10}><Text style={s.skip}>Skip</Text></Pressable> : <View />}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={x => x.key}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({length: width, offset: width * i, index: i})}
        renderItem={({item}) => (
          <View style={[s.slide, {width}]}>
            <Illustration slide={item} />
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.text}>{item.text}</Text>
          </View>
        )}
      />

      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((x, i) => <View key={x.key} style={[s.dot, i === index && s.dotOn]} />)}
        </View>
        <Button title={last ? 'Get started' : 'Next'} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  top: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12},
  brand: {fontSize: 14, fontWeight: '800', color: colors.primaryDark},
  skip: {color: colors.muted, fontWeight: '700', fontSize: 13},
  slide: {flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center'},
  art: {
    width: 270, height: 270, borderRadius: 135, alignItems: 'center', justifyContent: 'center', marginBottom: 40,
  },
  hero: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  satellite: {position: 'absolute', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center'},
  text: {fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 12, lineHeight: 23},
  footer: {paddingHorizontal: 24, paddingBottom: 20, gap: 20},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db'},
  dotOn: {width: 26, backgroundColor: colors.primary},
});

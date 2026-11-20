import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from './AuthContext';
import {colors} from './theme';
import Icon, {IconName} from './Icon';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import OtpScreen from './screens/OtpScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PlansScreen from './screens/PlansScreen';
import TeamScreen from './screens/owner/TeamScreen';
import HomeScreen from './screens/customer/HomeScreen';
import OwnerHomeScreen from './screens/owner/OwnerHomeScreen';
import ShopsScreen from './screens/customer/ShopsScreen';
import PaymentScreen from './screens/PaymentScreen';
import ShopScreen from './screens/customer/ShopScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import NewOrderScreen from './screens/customer/NewOrderScreen';
import OrdersScreen from './screens/customer/OrdersScreen';
import OwnerOrdersScreen from './screens/owner/OwnerOrdersScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Outlined icon normally, filled icon for the selected tab.
const icon = (name: IconName) => ({focused, color}: {focused: boolean; color: string}) =>
  <Icon name={name} size={20} color={color} filled={focused} />;

const ITEM = {justifyContent: 'center' as const, alignItems: 'center' as const, marginVertical: 10, paddingTop: 0, paddingBottom: 0};
// a thin line between neighbouring tabs
const DIVIDED = {...ITEM, borderRightWidth: 1, borderRightColor: '#e5e7eb'};

function useTabOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primaryDark,
    tabBarInactiveTintColor: colors.muted,
    tabBarShowLabel: false, // icons only
    tabBarIconStyle: {marginTop: -6},
    tabBarItemStyle: ITEM,
    tabBarStyle: {
      position: 'absolute' as const, left: 0, right: 0, marginHorizontal: 28, bottom: Math.max(insets.bottom, 8) + 16,
      height: 48, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, borderRadius: 22,
      backgroundColor: '#fff', elevation: 14,
      shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: {width: 0, height: 6},
    },
  };
}

function CustomerTabs() {
  const opts = useTabOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Home" component={HomeScreen} options={{tabBarItemStyle: DIVIDED, tabBarIcon: icon('home')}} />
      <Tab.Screen name="Shops" component={ShopsScreen} options={{tabBarItemStyle: DIVIDED, tabBarIcon: icon('storefront')}} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{tabBarItemStyle: DIVIDED, tabBarIcon: icon('receipt')}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{tabBarIcon: icon('person')}} />
    </Tab.Navigator>
  );
}

function OwnerTabs() {
  const opts = useTabOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Dashboard" component={OwnerHomeScreen} options={{tabBarItemStyle: DIVIDED, tabBarIcon: icon('home'), title: 'Home'}} />
      <Tab.Screen name="Queue" component={OwnerOrdersScreen} options={{tabBarItemStyle: DIVIDED, tabBarIcon: icon('list'), title: 'Orders'}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{tabBarIcon: icon('person'), title: 'Profile'}} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const {user, booting, onboarded, account} = useAuth();
  if (booting) return <SplashScreen />;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {!user && !onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : !user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
          </>
        ) : user.role === 'owner' && !account.subscription ? (
          // A shop owner must buy a plan before using the app
          <><Stack.Screen name="OwnerPlans" component={PlansScreen} initialParams={{required: true}} /><Stack.Screen name="Payment" component={PaymentScreen} /></>
        ) : user.role === 'owner' ? (
          <>
            <Stack.Screen name="OwnerHome" component={OwnerTabs} />
            <Stack.Screen name="Plans" component={PlansScreen} />
            <Stack.Screen name="Team" component={TeamScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
            <Stack.Screen name="Shop" component={ShopScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="NewOrder" component={NewOrderScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Plans" component={PlansScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

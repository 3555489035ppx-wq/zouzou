import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const SplashPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.SplashPage })))
const LoginPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.LoginPage })))
const OnboardingPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OnboardingPage })))
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const TravelNewPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.TravelNewPage })))
const UnderstandingPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.UnderstandingPage })))
const PlansPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.PlansPage })))
const PlanDetailPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.PlanDetailPage })))
const FriendsPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.FriendsPage })))
const VotePage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.VotePage })))
const TripsPage = lazy(() => import('./pages/TripPages').then((module) => ({ default: module.TripsPage })))
const TripReplayPage = lazy(() => import('./pages/TripPages').then((module) => ({ default: module.TripReplayPage })))
const DiscoverPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverPage })))
const DiscoverDetailPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverDetailPage })))
const DiscoverPublishPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverPublishPage })))
const DiscoverReplayPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverReplayPage })))
const PeopleListPage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.PeopleListPage })))
const ProfileEditPage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfileEditPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfilePage })))
const NotificationsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.NotificationsPage })))
const QuickPlannerPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.QuickPlannerPage })))
const SettingsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.SettingsPage })))
const DemoPage = lazy(() => import('./pages/DemoPage').then((module) => ({ default: module.DemoPage })))
const BotLabPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.BotLabPage })))
const PresentationPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.PresentationPage })))

export default function App() {
  return <Suspense fallback={<div className="route-loading" role="status">正在打开页面…</div>}><Routes>
    <Route path="/" element={<PresentationPage />} />
    <Route path="/splash" element={<SplashPage />} />
    <Route path="/app" element={<Navigate to="/home" replace />} />
    <Route path="/__presentation" element={<PresentationPage />} />
    <Route path="/__bot" element={<BotLabPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/home" element={<HomePage />} />
    <Route path="/travel/new" element={<TravelNewPage />} />
    <Route path="/travel/understanding" element={<UnderstandingPage />} />
    <Route path="/travel/plans" element={<PlansPage />} />
    <Route path="/travel/plan/:id" element={<PlanDetailPage />} />
    <Route path="/travel/edit" element={<Navigate to="/travel/plan/match" replace />} />
    <Route path="/travel/friends" element={<FriendsPage />} />
    <Route path="/travel/vote" element={<VotePage />} />
    <Route path="/trips" element={<TripsPage />} />
    <Route path="/trips/:id" element={<TripsPage />} />
    <Route path="/trips/:id/replay" element={<TripReplayPage />} />
    <Route path="/community" element={<DiscoverPage />} />
    <Route path="/community/search" element={<DiscoverPage />} />
    <Route path="/community/:id/replay" element={<DiscoverReplayPage />} />
    <Route path="/community/:id" element={<DiscoverDetailPage />} />
    <Route path="/community/publish" element={<DiscoverPublishPage />} />
    <Route path="/discover" element={<DiscoverPage />} />
    <Route path="/discover/publish" element={<DiscoverPublishPage />} />
    <Route path="/discover/:id/replay" element={<DiscoverReplayPage />} />
    <Route path="/discover/:id" element={<DiscoverDetailPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/profile/trips" element={<ProfilePage initialTab="行程" />} />
    <Route path="/profile/posts" element={<ProfilePage initialTab="发布" />} />
    <Route path="/profile/favorites" element={<ProfilePage initialTab="收藏" />} />
    <Route path="/profile/likes" element={<ProfilePage initialTab="喜欢" />} />
    <Route path="/profile/following" element={<PeopleListPage title="关注" />} />
    <Route path="/profile/followers" element={<PeopleListPage title="粉丝" />} />
    <Route path="/profile/edit" element={<ProfileEditPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/weekend" element={<QuickPlannerPage kind="weekend" />} />
    <Route path="/date" element={<QuickPlannerPage kind="date" />} />
    <Route path="/dining" element={<QuickPlannerPage kind="dining" />} />
    <Route path="/__demo" element={<DemoPage />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense>
}

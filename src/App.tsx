import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { track } from './services/analytics'

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
const ProfileEditPage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfileEditPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfilePage })))
const NotificationsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.NotificationsPage })))
const QuickPlannerPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.QuickPlannerPage })))
const SettingsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.SettingsPage })))
const DemoPage = lazy(() => import('./pages/DemoPage').then((module) => ({ default: module.DemoPage })))
const BotLabPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.BotLabPage })))
const PresentationPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.PresentationPage })))
const JourneyImageReviewPage = lazy(() => import('./pages/JourneyImageReviewPage').then((module) => ({ default: module.JourneyImageReviewPage })))
const JourneyToolsPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.JourneyToolsPage })))
const ExpensePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.ExpensePage })))
const PackingPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.PackingPage })))
const FootprintPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.FootprintPage })))
const PlaceKnowledgePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.PlaceKnowledgePage })))
const JourneySharePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.JourneySharePage })))
const GroupPlanCreatePage = lazy(() => import('./pages/GroupPlanPages').then((module) => ({ default: module.GroupPlanCreatePage })))
const GroupPlanDetailPage = lazy(() => import('./pages/GroupPlanPages').then((module) => ({ default: module.GroupPlanDetailPage })))
const GroupPlanInvitePage = lazy(() => import('./pages/GroupPlanPages').then((module) => ({ default: module.GroupPlanInvitePage })))

export default function App() {
  useEffect(() => { track('app_open') }, [])
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
    <Route path="/journey/tools" element={<JourneyToolsPage />} />
    <Route path="/journey/expense" element={<ExpensePage />} />
    <Route path="/journey/packing" element={<PackingPage />} />
    <Route path="/journey/footprint" element={<FootprintPage />} />
    <Route path="/journey/share" element={<JourneySharePage />} />
    <Route path="/journey/place/:placeId" element={<PlaceKnowledgePage />} />
    <Route path="/trips" element={<TripsPage />} />
    <Route path="/trips/:id" element={<TripsPage />} />
    <Route path="/trips/:id/replay" element={<TripReplayPage />} />
    <Route path="/community" element={<DiscoverPage />} />
    <Route path="/community/search" element={<DiscoverPage />} />
    <Route path="/community/:id/replay" element={<DiscoverReplayPage />} />
    <Route path="/community/:id" element={<DiscoverDetailPage />} />
    <Route path="/community/publish" element={<DiscoverPublishPage />} />
    <Route path="/discover" element={<DiscoverPage />} />
    <Route path="/discover/search" element={<DiscoverPage />} />
    <Route path="/discover/publish" element={<DiscoverPublishPage />} />
    <Route path="/discover/:id/replay" element={<DiscoverReplayPage />} />
    <Route path="/discover/:id" element={<DiscoverDetailPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/profile/trips" element={<ProfilePage initialTab="行程" />} />
    <Route path="/profile/posts" element={<ProfilePage initialTab="发布" />} />
    <Route path="/profile/favorites" element={<ProfilePage initialTab="收藏" />} />
    <Route path="/profile/edit" element={<ProfileEditPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/weekend" element={<GroupPlanCreatePage type="weekend" />} />
    <Route path="/date" element={<GroupPlanCreatePage type="date" />} />
    <Route path="/dining" element={<GroupPlanCreatePage type="dining" />} />
    <Route path="/group-plans/:planId" element={<GroupPlanDetailPage />} />
    <Route path="/group-plans/invite/:code" element={<GroupPlanInvitePage />} />
    <Route path="/__demo" element={<DemoPage />} />
    {import.meta.env.DEV ? <Route path="/__journey-images" element={<JourneyImageReviewPage />} /> : null}
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense>
}

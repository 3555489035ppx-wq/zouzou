import { TripScope } from './components/TripScope'
import { AppUpdateNotice } from './components/AppUpdateNotice'
const InstallPage = lazy(() => import('./pages/InstallPage'))
const PublicationDetail = lazy(() => import('./pages/PublicationPages').then(module=>({default:module.PublicationDetail})))
const SharedTripPage = lazy(() => import('./pages/SharedTripPage').then(module => ({ default: module.SharedTripPage })))
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LaunchPlaceholder } from './components/LaunchPlaceholder'
import { track } from './services/analytics'

const StartupPreviewPage = lazy(() => import('./components/StartupExperience').then(module => ({ default: module.StartupPreviewPage })))
const SplashPage = lazy(() => import('./components/StartupExperience').then((module) => ({ default: module.StartupExperience })))
const LoginPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.LoginPage })))
const OnboardingPage = lazy(() => import('./pages/AccountPages').then((module) => ({ default: module.OnboardingPage })))
const TravelNewPage = lazy(() => import('./pages/TripRequestForm').then((module) => ({ default: module.TripRequestForm })))
const UnderstandingPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.UnderstandingPage })))
const PlansPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.PlansPage })))
const PlanDetailPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.PlanDetailPage })))
const FriendsPage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.FriendsPage })))
const VotePage = lazy(() => import('./pages/TravelPages').then((module) => ({ default: module.VotePage })))
const TripsPage = lazy(() => import('./pages/SavedTripExecution').then((module) => ({ default: module.SavedTripExecution })))
const TripReplayPage = lazy(() => import('./pages/TripPages').then((module) => ({ default: module.TripReplayPage })))
const DiscoverPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverPage })))
const DiscoverCityPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverCityPage })))
const DiscoverDetailPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverDetailPage })))
const DiscoverPublishPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverPublishPage })))
const DiscoverReplayPage = lazy(() => import('./pages/DiscoverPages').then((module) => ({ default: module.DiscoverReplayPage })))
const ProfileEditPage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfileEditPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePages').then((module) => ({ default: module.ProfilePage })))
const NotificationsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.NotificationsPage })))
const SettingsPage = lazy(() => import('./pages/UtilityPages').then((module) => ({ default: module.SettingsPage })))
const DemoPage = lazy(() => import('./pages/DemoPage').then((module) => ({ default: module.DemoPage })))
const BotLabPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.BotLabPage })))
const PresentationPage = lazy(() => import('./pages/SystemPages').then((module) => ({ default: module.PresentationPage })))
const JourneyImageReviewPage = import.meta.env.DEV ? lazy(() => import('./pages/JourneyImageReviewPage').then((module) => ({ default: module.JourneyImageReviewPage }))) : () => null
const JourneyToolsPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.JourneyToolsPage })))
const ExpensePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.ExpensePage })))
const PackingPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.PackingPage })))
const FootprintPage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.FootprintPage })))
const PlaceKnowledgePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.PlaceKnowledgePage })))
const JourneySharePage = lazy(() => import('./pages/JourneyToolsPages').then((module) => ({ default: module.JourneySharePage })))
const GroupPlanDetailPage = lazy(() => import('./pages/GroupPlanPages').then((module) => ({ default: module.GroupPlanDetailPage })))
const GroupPlanInvitePage = lazy(() => import('./pages/GroupPlanPages').then((module) => ({ default: module.GroupPlanInvitePage })))

function RoutePlaceholder() {
  const { pathname } = useLocation()
  return pathname === '/' || pathname === '/splash' ? <LaunchPlaceholder /> : <div className="route-loading" aria-busy="true" aria-label="准备页面" />
}

export default function App() {
  useEffect(() => { track('app_open') }, [])
  return <><AppUpdateNotice /><Suspense fallback={<RoutePlaceholder />}><Routes>
    <Route path="/settings/install" element={<InstallPage />} />
    <Route path="/" element={<SplashPage />} />
    <Route path="/splash" element={<SplashPage />} />
    <Route path="/__start-preview" element={<StartupPreviewPage />} />
    <Route path="/app" element={<Navigate to="/home" replace />} />
    <Route path="/__presentation" element={<PresentationPage />} />
    <Route path="/__bot" element={<BotLabPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/share/:token" element={<SharedTripPage />} />
    <Route path="/home" element={<SplashPage />} />
    <Route path="/travel/new" element={<TravelNewPage />} />
    <Route path="/travel/understanding" element={<UnderstandingPage />} />
    <Route path="/travel/plans" element={<PlansPage />} />
    <Route path="/travel/plan/:id" element={<PlanDetailPage />} />
    <Route path="/travel/edit" element={<Navigate to="/travel/plan/match" replace />} />
    <Route path="/travel/friends" element={<FriendsPage />} />
    <Route path="/travel/vote" element={<VotePage />} />
    <Route path="/journey/tools" element={<TripScope><JourneyToolsPage /></TripScope>} />
    <Route path="/journey/expense" element={<TripScope><ExpensePage /></TripScope>} />
    <Route path="/journey/packing" element={<TripScope><PackingPage /></TripScope>} />
    <Route path="/journey/footprint" element={<TripScope global><FootprintPage /></TripScope>} />
    <Route path="/journey/share" element={<TripScope><JourneySharePage /></TripScope>} />
    <Route path="/journey/place/:placeId" element={<TripScope><PlaceKnowledgePage /></TripScope>} />
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
    <Route path="/publications/:id" element={<PublicationDetail />} />
    <Route path="/discover/publish" element={<DiscoverPublishPage />} />
    <Route path="/discover/cities/:city" element={<DiscoverCityPage />} />
    <Route path="/discover/:id/replay" element={<DiscoverReplayPage />} />
    <Route path="/discover/:id" element={<DiscoverDetailPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/profile/trips" element={<Navigate to="/trips" replace />} />
    <Route path="/profile/posts" element={<ProfilePage initialTab="发布" />} />
    <Route path="/profile/favorites" element={<ProfilePage initialTab="收藏" />} />
    <Route path="/profile/edit" element={<ProfileEditPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/weekend" element={<Navigate to="/travel/new" replace />} />
    <Route path="/date" element={<Navigate to="/travel/new" replace />} />
    <Route path="/dining" element={<Navigate to="/travel/new" replace />} />
    <Route path="/group-plans/:planId" element={<GroupPlanDetailPage />} />
    <Route path="/group-plans/invite/:code" element={<GroupPlanInvitePage />} />
    <Route path="/__demo" element={<DemoPage />} />
    {import.meta.env.DEV ? <Route path="/__journey-images" element={<JourneyImageReviewPage />} /> : null}
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Suspense></>
}

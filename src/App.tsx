import { Navigate, Route, Routes } from 'react-router-dom'
import { SplashPage, LoginPage, OnboardingPage } from './pages/AccountPages'
import { HomePage } from './pages/HomePage'
import { FriendsPage, PlanDetailPage, PlansPage, TravelNewPage, UnderstandingPage, VotePage } from './pages/TravelPages'
import { TripReplayPage, TripsPage } from './pages/TripPages'
import { CommunityDetailPage, CommunityPage, CommunityReplayPage, CommunitySearchPage, PublishPage } from './pages/CommunityPages'
import { PeopleListPage, ProfileEditPage, ProfilePage } from './pages/ProfilePages'
import { NotificationsPage, QuickPlannerPage, SettingsPage } from './pages/UtilityPages'
import { DemoPage } from './pages/DemoPage'
import { BotLabPage, PresentationPage } from './pages/SystemPages'

export default function App() {
  return <Routes>
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
    <Route path="/community" element={<CommunityPage />} />
    <Route path="/community/search" element={<CommunitySearchPage />} />
    <Route path="/community/:id" element={<CommunityDetailPage />} />
    <Route path="/community/:id/replay" element={<CommunityReplayPage />} />
    <Route path="/community/publish" element={<PublishPage />} />
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
  </Routes>
}

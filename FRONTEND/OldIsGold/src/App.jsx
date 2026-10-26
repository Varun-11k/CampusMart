import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const ProductDetails = lazy(() => import('./pages/ProductDetails'))
const Profile = lazy(() => import('./pages/Profile'))
const Register = lazy(() => import('./pages/Register'))
const SellProduct = lazy(() => import('./pages/SellProduct'))
const Messages = lazy(() => import('./pages/Messages'))
const Conversation = lazy(() => import('./pages/Conversation'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const CampusDashboard = lazy(() => import('./pages/CampusDashboard'))
const CampusDeals = lazy(() => import('./pages/CampusDeals'))
const CampusChallenges = lazy(() => import('./pages/CampusChallenges'))
const LostFound = lazy(() => import('./pages/LostFound'))
const LostFoundDetails = lazy(() => import('./pages/LostFoundDetails'))
const LostFoundReportForm = lazy(() => import('./pages/LostFoundReportForm'))
const MyLostFoundReports = lazy(() => import('./pages/MyLostFoundReports'))
const CampusVoices = lazy(() => import('./pages/CampusVoices'))
const CampusVoiceCreate = lazy(() => import('./pages/CampusVoiceCreate'))
const CampusVoiceDetails = lazy(() => import('./pages/CampusVoiceDetails'))
const CampusVoiceMyPosts = lazy(() => import('./pages/CampusVoiceMyPosts'))
const Resources = lazy(() => import('./pages/Resources'))
const ResourceShare = lazy(() => import('./pages/ResourceShare'))
const ResourceDetails = lazy(() => import('./pages/ResourceDetails'))
const MyResources = lazy(() => import('./pages/MyResources'))
const CampusAI = lazy(() => import('./pages/CampusAI'))
const CampusExchange = lazy(() => import('./pages/CampusExchange'))
const CampusExchangeForm = lazy(() => import('./pages/CampusExchangeForm'))
const CampusExchangeDetails = lazy(() => import('./pages/CampusExchangeDetails'))
const CampusFeed = lazy(() => import('./pages/CampusFeed'))
const CampusFeedEdit = lazy(() => import('./pages/CampusFeedEdit'))
const CampusFeedReels = lazy(() => import('./pages/CampusFeedReels'))
const MyCampusExchanges = lazy(() => import('./pages/MyCampusExchanges'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const NotFound = lazy(() => import('./pages/NotFound'))
import './App.css'
import './premium-ui.css'

function LazyPage({ page: Page, ...props }) {
  return <Suspense fallback={<div className="route-loading" role="status">Loading CampusMart...</div>}><Page {...props} /></Suspense>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LazyPage page={Home} />} />
          <Route path="/home" element={<LazyPage page={CampusDashboard} />} />
          <Route path="/deals" element={<LazyPage page={CampusDeals} />} />
          <Route path="/challenges" element={<LazyPage page={CampusChallenges} />} />
          <Route path="/lost-found" element={<LazyPage page={LostFound} />} />
          <Route path="/lost-found/report" element={<LazyPage page={LostFoundReportForm} />} />
          <Route path="/lost-found/my-reports" element={<LazyPage page={MyLostFoundReports} />} />
          <Route path="/lost-found/:id" element={<LazyPage page={LostFoundDetails} />} />
          <Route path="/campus-voices" element={<LazyPage page={CampusVoices} />} />
          <Route path="/campus-voices/create" element={<LazyPage page={CampusVoiceCreate} />} />
          <Route path="/campus-voices/my-posts" element={<LazyPage page={CampusVoiceMyPosts} />} />
          <Route path="/campus-voices/:id" element={<LazyPage page={CampusVoiceDetails} />} />
          <Route path="/resources" element={<LazyPage page={Resources} />} />
          <Route path="/resources/share" element={<LazyPage page={ResourceShare} />} />
          <Route path="/resources/my-resources" element={<LazyPage page={MyResources} />} />
          <Route path="/resources/:id" element={<LazyPage page={ResourceDetails} />} />
          <Route path="/campus-ai" element={<LazyPage page={CampusAI} />} />
          <Route path="/campus-exchange" element={<LazyPage page={CampusExchange} />} />
          <Route path="/campus-exchange/create" element={<LazyPage page={CampusExchangeForm} />} />
          <Route path="/campus-exchange/my-exchanges" element={<LazyPage page={MyCampusExchanges} />} />
          <Route path="/campus-exchange/:id" element={<LazyPage page={CampusExchangeDetails} />} />
          <Route path="/marketplace" element={<LazyPage page={Marketplace} />} />
          <Route path="/products/:productId" element={<LazyPage page={ProductDetails} />} />
          <Route path="/login" element={<LazyPage page={Login} />} />
          <Route path="/register" element={<LazyPage page={Register} />} />
          <Route path="/forgot-password" element={<LazyPage page={ForgotPassword} />} />
          <Route path="/reset-password" element={<LazyPage page={ResetPassword} />} />
          <Route path="/verify-email" element={<LazyPage page={VerifyEmail} />} />
          <Route path="/settings" element={<LazyPage page={AccountSettings} />} />
          <Route path="/sell" element={<LazyPage page={SellProduct} />} />
          <Route path="/sell/:productId" element={<LazyPage page={SellProduct} />} />
          <Route path="/messages" element={<LazyPage page={Messages} />} />
          <Route path="/messages/:conversationId" element={<LazyPage page={Conversation} />} />
          <Route path="/wishlist" element={<LazyPage page={Wishlist} />} />
          <Route path="/notifications" element={<LazyPage page={Notifications} />} />
          <Route path="/campus-feed" element={<LazyPage page={CampusFeed} />} />
          <Route path="/campus-feed/saved" element={<LazyPage page={CampusFeed} />} />
          <Route path="/campus-feed/mine" element={<LazyPage page={CampusFeed} />} />
          <Route path="/campus-feed/reels" element={<LazyPage page={CampusFeedReels} />} />
          <Route path="/campus-feed/edit/:id" element={<LazyPage page={CampusFeedEdit} />} />
          <Route path="/admin" element={<LazyPage page={AdminDashboard} />} />
          <Route path="/profile" element={<LazyPage page={Profile} />} />
          <Route path="/privacy" element={<LazyPage page={LegalPage} document="privacy" />} />
          <Route path="/terms" element={<LazyPage page={LegalPage} document="terms" />} />
          <Route path="*" element={<LazyPage page={NotFound} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

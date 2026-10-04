import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Marketplace from './pages/Marketplace'
import ProductDetails from './pages/ProductDetails'
import Profile from './pages/Profile'
import Register from './pages/Register'
import SellProduct from './pages/SellProduct'
import Messages from './pages/Messages'
import Conversation from './pages/Conversation'
import Wishlist from './pages/Wishlist'
import Notifications from './pages/Notifications'
import AdminDashboard from './pages/AdminDashboard'
import CampusHome from './pages/CampusHome'
import CampusDashboard from './pages/CampusDashboard'
import CampusDeals from './pages/CampusDeals'
import CampusChallenges from './pages/CampusChallenges'
import LostFound from './pages/LostFound'
import LostFoundDetails from './pages/LostFoundDetails'
import LostFoundReportForm from './pages/LostFoundReportForm'
import MyLostFoundReports from './pages/MyLostFoundReports'
import CampusVoices from './pages/CampusVoices'
import CampusVoiceCreate from './pages/CampusVoiceCreate'
import CampusVoiceDetails from './pages/CampusVoiceDetails'
import CampusVoiceMyPosts from './pages/CampusVoiceMyPosts'
import Resources from './pages/Resources'
import ResourceShare from './pages/ResourceShare'
import ResourceDetails from './pages/ResourceDetails'
import MyResources from './pages/MyResources'
import CampusAI from './pages/CampusAI'
import CampusExchange from './pages/CampusExchange'
import CampusExchangeForm from './pages/CampusExchangeForm'
import CampusExchangeDetails from './pages/CampusExchangeDetails'
import MyCampusExchanges from './pages/MyCampusExchanges'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<CampusDashboard />} />
          <Route path="/deals" element={<CampusDeals />} />
          <Route path="/challenges" element={<CampusChallenges />} />
          <Route path="/lost-found" element={<LostFound />} />
          <Route path="/lost-found/report" element={<LostFoundReportForm />} />
          <Route path="/lost-found/my-reports" element={<MyLostFoundReports />} />
          <Route path="/lost-found/:id" element={<LostFoundDetails />} />
          <Route path="/campus-voices" element={<CampusVoices />} />
          <Route path="/campus-voices/create" element={<CampusVoiceCreate />} />
          <Route path="/campus-voices/my-posts" element={<CampusVoiceMyPosts />} />
          <Route path="/campus-voices/:id" element={<CampusVoiceDetails />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/share" element={<ResourceShare />} />
          <Route path="/resources/my-resources" element={<MyResources />} />
          <Route path="/resources/:id" element={<ResourceDetails />} />
          <Route path="/campus-ai" element={<CampusAI />} />
          <Route path="/campus-exchange" element={<CampusExchange />} />
          <Route path="/campus-exchange/create" element={<CampusExchangeForm />} />
          <Route path="/campus-exchange/my-exchanges" element={<MyCampusExchanges />} />
          <Route path="/campus-exchange/:id" element={<CampusExchangeDetails />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/products/:productId" element={<ProductDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sell" element={<SellProduct />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Conversation />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

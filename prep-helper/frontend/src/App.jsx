import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { 
  LayoutDashboard, 
  UploadCloud, 
  BookOpen, 
  FileText, 
  Layers, 
  TrendingUp, 
  FolderLock, 
  Settings as SettingsIcon, 
  Tags,
  Zap
} from 'lucide-react'

import { useAppStore } from './stores/appStore'
import { getSettings } from './api/client'

// Page Imports
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import QuestionBank from './pages/QuestionBank'
import StudyNotes from './pages/StudyNotes'
import Flashcards from './pages/Flashcards'
import Progress from './pages/Progress'
import TagManager from './pages/TagManager'
import Documents from './pages/Documents'
import VaultTools from './pages/VaultTools'
import Settings from './pages/Settings'

const queryClient = new QueryClient()

function Sidebar() {
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/upload', label: 'Upload PDF', icon: UploadCloud },
    { to: '/questions', label: 'Question Bank', icon: BookOpen },
    { to: '/notes', label: 'Study Notes', icon: FileText },
    { to: '/flashcards', label: 'Flashcards', icon: Zap },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
    { to: '/tags', label: 'Tag Manager', icon: Tags },
    { to: '/documents', label: 'My Documents', icon: Layers },
    { to: '/vault', label: 'Vault Tools', icon: FolderLock },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <aside className="hidden md:flex flex-col h-screen fixed left-0 top-0 bg-slate-900 border-r border-slate-800 transition-all duration-300 z-30 w-16 xl:w-64">
      <div className="p-4 xl:p-6 border-b border-slate-800 flex items-center justify-center xl:justify-start space-x-2">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30 shrink-0">
          PH
        </div>
        <span className="font-bold text-lg tracking-tight text-white hidden xl:block truncate">Prep Helper</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 xl:px-4 py-6 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center justify-center xl:justify-start space-x-0 xl:space-x-3 px-3 xl:px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
              title={link.label}
            >
              <Icon className="h-5 w-5 transition-transform group-hover:scale-105 shrink-0" />
              <span className="hidden xl:block truncate text-sm">{link.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500 hidden xl:block">
        Local Vault v1.0.0
      </div>
    </aside>
  )
}

function BottomNavigation() {
  const links = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/upload', label: 'Upload', icon: UploadCloud },
    { to: '/questions', label: 'Q&A', icon: BookOpen },
    { to: '/notes', label: 'Notes', icon: FileText },
    { to: '/flashcards', label: 'Study', icon: Zap },
  ]
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-50 px-2 py-1">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center space-y-1 text-slate-450 hover:text-white transition-all w-12 ${
                isActive ? 'text-indigo-400 font-bold' : ''
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[9px] truncate">{link.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function MainLayout({ children }) {
  const vaultConfigured = useAppStore((state) => state.vaultConfigured)
  const location = useLocation()

  // Redirect to settings page if vault has not been configured
  if (!vaultConfigured && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="min-h-screen pl-0 md:pl-16 xl:pl-64 md:pb-0 pb-16 bg-slate-950 flex flex-col transition-all duration-300">
      {!vaultConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 text-sm text-amber-200 flex justify-between items-center">
          <span>⚠️ Vault path has not been configured yet. Set up a vault folder to get started.</span>
          <NavLink to="/settings" className="underline font-medium hover:text-amber-100">Configure Now</NavLink>
        </div>
      )}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

function AppContent() {
  const setSettings = useAppStore((state) => state.setSettings)

  useEffect(() => {
    // Initial fetch of configuration preferences
    getSettings()
      .then((res) => {
        if (res.data) {
          setSettings(res.data)
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err)
      })
  }, [setSettings])

  return (
    <div className="flex">
      <Sidebar />
      <BottomNavigation />
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/questions" element={<QuestionBank />} />
          <Route path="/notes" element={<StudyNotes />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/tags" element={<TagManager />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/vault" element={<VaultTools />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            },
          }} 
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

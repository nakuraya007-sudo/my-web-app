import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { StoryDetail } from './pages/StoryDetail';
import { Reader } from './pages/Reader';
import { CreateStory } from './pages/CreateStory';
import { ManageStories } from './pages/ManageStories';
import { ManageChapters } from './pages/ManageChapters';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthProvider } from './components/AuthProvider';
import { StoryCarousel } from './components/StoryCarousel';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-pink-50 p-8 text-center">
          <div className="bg-white p-8 rounded-[40px] kawaii-shadow border-4 border-pink-200 max-w-md">
            <h2 className="text-2xl font-bold text-pink-500 mb-4">Hic, có lỗi gì đó rồi... (´; ω ;`)</h2>
            <p className="text-gray-600 mb-6 font-medium">Trang vương quốc đang gặp một chút trục trặc nhỏ. Bạn hãy thử tải lại trang hoặc quay về trang chủ nha! ✿</p>
            <pre className="text-[10px] bg-gray-100 p-4 rounded-xl mb-6 overflow-auto text-left max-h-40">{this.state.error?.message}</pre>
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-pink-400 text-white px-8 py-3 rounded-2xl font-bold uppercase tracking-widest hover:scale-105 transition-all"
            >
              Về trang chủ ✿
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const location = useLocation();
  const showCarousel = !['/reader', '/story'].some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#4A4A4A] font-sans flex flex-col">
      <Navbar />
      {showCarousel && <StoryCarousel />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/story/:id" element={<StoryDetail />} />
          <Route path="/reader/:storyId/:chapterId" element={<Reader />} />
          <Route path="/admin/create" element={<CreateStory />} />
          <Route path="/admin/edit/:id" element={<CreateStory />} />
          <Route path="/admin/manage" element={<ManageStories />} />
          <Route path="/admin/chapters/:storyId" element={<ManageChapters />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

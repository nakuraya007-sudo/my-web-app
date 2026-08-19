import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { StoryCard } from '../components/StoryCard';
import { Sparkles, CheckCircle2, ChevronRight, Loader2, Bell } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useLocation } from 'react-router-dom';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const Home = () => {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const searchName = searchParams.get('search')?.toLowerCase();

  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    const storiesRef = collection(db, 'stories');
    let q;
    if (isSiteAdmin) {
      q = query(storiesRef, orderBy('createdAt', 'desc'));
    } else {
      q = query(storiesRef, where('visibility', '==', 'public'), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStories(storiesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isSiteAdmin]);

  const filteredStories = stories.filter(s => {
    if (!searchName) return true;
    return s.title?.toLowerCase().includes(searchName) || 
           s.hanViet?.toLowerCase().includes(searchName) ||
           s.originalAuthor?.toLowerCase().includes(searchName);
  });

  const announcements = filteredStories.filter(s => s.categories?.includes('Thông báo'));
  const regularStories = filteredStories.filter(s => !s.categories?.includes('Thông báo'));
  const completedStories = regularStories.filter(s => s.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Announcements Section */}
      {!loading && announcements.length > 0 && !searchName && (
        <section className="mb-24">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <div className="bg-pink-100 p-3 rounded-[20px] kawaii-shadow">
                <Bell className="text-pink-400 w-8 h-8" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-[#4A4A4A] italic">Thông tin YACchan</h2>
                <p className="text-xs font-bold text-[#4A4A4A]/30 uppercase tracking-[0.3em] mt-1">Thông báo quan trọng từ chủ nhà</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-10">
            {announcements.map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* New Updates Section */}
      <section className="mb-24">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-[20px] kawaii-shadow">
              <Sparkles className="text-orange-400 w-8 h-8" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-[#4A4A4A] italic">Tác phẩm mới cập nhật</h2>
              <p className="text-xs font-bold text-[#4A4A4A]/30 uppercase tracking-[0.3em] mt-1">Những chương truyện vừa lên sóng</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#4A4A4A]/40 italic">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Đang tìm truyện hay cho bạn nè... (◕‿◕✿)</p>
          </div>
        ) : regularStories.length === 0 ? (
          <div className="text-center py-20 bg-soft-yellow/20 rounded-[40px] border-4 border-dashed border-accent-yellow/20">
            <p className="text-[#4A4A4A]/40 font-medium italic mb-2">Chưa có truyện nào phù hợp hết á... (´; ω ;`)</p>
            <p className="text-[10px] font-bold text-[#4A4A4A]/20 uppercase tracking-widest leading-none">Bạn thử tìm từ khóa khác xem sao nha!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-10">
            {regularStories.map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>

      {/* Completed Section */}
      {!loading && completedStories.length > 0 && (
        <section className="mb-24">
          <div className="flex justify-between items-center mb-12">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-[20px] kawaii-shadow">
                <CheckCircle2 className="text-green-500 w-8 h-8" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-[#4A4A4A] italic">Truyện đã hoàn thành</h2>
                <p className="text-xs font-bold text-[#4A4A4A]/30 uppercase tracking-[0.3em] mt-1">Những hành trình đã về đích</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-10">
            {completedStories.map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* Kawaii Decoration */}
      <div className="flex justify-center py-10 opacity-30">
        <img 
          src="https://cdn-icons-png.flaticon.com/512/2663/2663067.png" 
          alt="cat mascot" 
          className="w-32 animate-bounce"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

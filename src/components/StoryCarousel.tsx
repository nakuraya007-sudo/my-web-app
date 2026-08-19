import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { Heart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const OWNER_EMAIL = 'nakuraya007@gmail.com';

export const StoryCarousel = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const isSiteAdmin = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  useEffect(() => {
    const storiesRef = collection(db, 'stories');
    let q;
    if (isSiteAdmin) {
      q = query(storiesRef, where('bannerImage', '!=', ''), orderBy('bannerImage'), orderBy('createdAt', 'desc'), limit(5));
    } else {
      q = query(storiesRef, where('visibility', '==', 'public'), where('bannerImage', '!=', ''), orderBy('bannerImage'), orderBy('createdAt', 'desc'), limit(5));
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

  useEffect(() => {
    if (stories.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % stories.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [stories]);

  if (loading) return (
    <div className="w-full h-[300px] md:h-[500px] flex items-center justify-center bg-soft-yellow/20">
      <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
    </div>
  );

  if (stories.length === 0) return null;

  const story = stories[index];

  return (
    <div className="relative w-full max-w-[2000px] mx-auto aspect-[2000/388] overflow-hidden bg-soft-yellow group shadow-inner">
      <div className="absolute inset-0">
        <Link to={`/story/${story.id}`} className="block w-full h-full relative">
          <img 
            src={story.bannerImage} 
            alt={story.title} 
            className="w-full h-full object-cover transition-all duration-1000"
            referrerPolicy="no-referrer"
          />
          {/* Minimal overlay to indicate it's clickable and show title on hover */}
          <div className="absolute inset-x-0 bottom-0 py-12 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end px-12">
             <h2 className="text-white text-2xl font-bold italic drop-shadow-lg">{story.title} ✿</h2>
          </div>
        </Link>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        {stories.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setIndex(i); }}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === index ? 'bg-white w-6' : 'bg-white/40'}`}
          />
        ))}
      </div>
      
      <button 
        onClick={(e) => { e.preventDefault(); setIndex((i) => (i - 1 + stories.length) % stories.length); }}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/10 hover:bg-black/30 backdrop-blur-md rounded-full transition-all z-20 opacity-0 group-hover:opacity-100"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
      <button 
        onClick={(e) => { e.preventDefault(); setIndex((i) => (i + 1) % stories.length); }}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/10 hover:bg-black/30 backdrop-blur-md rounded-full transition-all z-20 opacity-0 group-hover:opacity-100"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

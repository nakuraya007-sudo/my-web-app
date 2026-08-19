import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Story } from '../types';
import { Star, Eye, BookOpen } from 'lucide-react';

interface StoryCardProps {
  story: Story;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group"
    >
      <Link to={`/story/${story.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] kawaii-shadow mb-4 bg-white border-4 border-white p-1">
          <img
            src={story.coverImage}
            alt={story.title}
            className="w-full h-full object-cover rounded-[28px] group-hover:scale-110 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl text-yellow-600 text-[10px] font-bold shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              {story.rating}
            </span>
            <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl text-blue-400 text-[10px] font-bold shadow-sm">
              <BookOpen className="w-3 h-3" />
              {story.chapterCount}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-400/80 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-[10px] font-bold uppercase tracking-[0.2em]">Khám phá ngay ✿</span>
          </div>
        </div>
        <h3 className="font-bold text-xl leading-tight text-[#4A4A4A] group-hover:text-orange-400 transition-colors mb-1 line-clamp-1 italic">{story.title}</h3>
        {story.originalAuthor && (
          <p className="text-xs font-bold text-[#4A4A4A]/50 uppercase tracking-widest mb-3">
             {story.originalAuthor}
          </p>
        )}
      </Link>
    </motion.div>
  );
};

export interface Story {
  id: string;
  title: string;
  description: string;
  warning?: string; // Cảnh báo
  info?: string;    // Thông tin thêm
  coverImage: string;
  authorId: string;
  authorName: string;
  originalAuthor?: string; // Tác giả gốc
  categories: string[];
  status: 'ongoing' | 'completed' | 'dropped';
  views: number;
  rating: number;
  chapterCount: number;
  createdAt: number;
  updatedAt: number;
  followerCount?: number;
}

export interface Chapter {
  id: string;
  storyId: string;
  title: string;
  content: string;
  chapterNumber: number;
  views: number;  // Hiện số lượt xem
  likes: number;  // Hiện số lượt like
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  bio?: string;
  favoriteStories?: string[];
  followers?: string[];
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string; // Thêm ảnh cho bài đăng
  createdAt: number;
  likes: number;
}

export interface Comment {
  id: string;
  storyId: string;
  chapterId?: string;
  paragraphIndex?: number; // Bình luận theo đoạn
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  createdAt: number;
}

export interface Review {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  rating: number;
  content: string; // > 100 từ
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'chapter' | 'post' | 'system';
  link: string;
  read: boolean;
  createdAt: number;
}

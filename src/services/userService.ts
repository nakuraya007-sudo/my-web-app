import { db } from '../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, collectionGroup, getDoc } from 'firebase/firestore';

export const userService = {
  async syncUserMetadata(userId: string, newName: string, newAvatar: string) {
    try {
      console.log('Syncing user metadata for:', userId);
      // We use collectionGroup to find all comments and reviews across all stories/posts
      const batch = writeBatch(db);
      
      // 1. Update comments in posts
      const commentsQuery = query(collectionGroup(db, 'comments'), where('userId', '==', userId));
      const postCommentsSnap = await getDocs(commentsQuery);
      postCommentsSnap.docs.forEach(d => {
        batch.update(d.ref, {
          userName: newName,
          userAvatar: newAvatar
        });
      });
      
      // 2. Update reviews in stories
      const reviewsQuery = query(collectionGroup(db, 'reviews'), where('userId', '==', userId));
      const reviewsSnap = await getDocs(reviewsQuery);
      reviewsSnap.docs.forEach(d => {
        batch.update(d.ref, {
          userName: newName,
          userAvatar: newAvatar
        });
      });

      await batch.commit();
      console.log('Sync completed! ✿');
    } catch (error) {
      console.error('Error syncing user metadata:', error);
    }
  },
  async saveReadingProgress(userId: string, storyId: string, chapterId: string, chapterTitle: string) {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', storyId);
      const batch = writeBatch(db);
      batch.set(progressRef, {
        chapterId,
        chapterTitle,
        updatedAt: new Date(),
      }, { merge: true });
      await batch.commit();
    } catch (error) {
      console.error('Error saving reading progress:', error);
    }
  },
  async getReadingProgress(userId: string, storyId: string) {
    try {
      const progressRef = doc(db, 'users', userId, 'progress', storyId);
      const progressSnap = await getDoc(progressRef);
      if (progressSnap.exists()) {
        return progressSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting reading progress:', error);
      return null;
    }
  }
};

import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, doc, query, where, deleteDoc, getDoc, setDoc } from 'firebase/firestore';

export type NotificationType = 'chapter' | 'post';

export const notificationService = {
  async followStory(userId: string, storyId: string) {
    try {
      const followId = `${userId}_${storyId}`;
      await setDoc(doc(db, 'follows', followId), {
        userId,
        storyId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error following story:', error);
    }
  },

  async unfollowStory(userId: string, storyId: string) {
    try {
      const followId = `${userId}_${storyId}`;
      await deleteDoc(doc(db, 'follows', followId));
    } catch (error) {
      console.error('Error unfollowing story:', error);
    }
  },

  async isFollowing(userId: string, storyId: string) {
    if (!userId) return false;
    try {
      const followId = `${userId}_${storyId}`;
      const snap = await getDoc(doc(db, 'follows', followId));
      return snap.exists();
    } catch (error) {
      console.error('Error checking follow status:', error);
      return false;
    }
  },

  async notifyFollowersOfChapter(storyId: string, storyTitle: string, chapterTitle: string, chapterNumber: number, isAnnouncement: boolean = false) {
    try {
      const notificationData = {
        title: storyTitle,
        message: `Chương ${chapterNumber}: ${chapterTitle} vừa mới ra lò nè! ✿`,
        storyId,
        chapterNumber,
        type: 'chapter',
        createdAt: serverTimestamp(),
        read: false
      };

      if (isAnnouncement) {
        // Create a global notification
        await addDoc(collection(db, 'global_notifications'), notificationData);
      }

      // Find all followers
      const followersQuery = query(collection(db, 'follows'), where('storyId', '==', storyId));
      const followersSnap = await getDocs(followersQuery);
      
      const batchPromises = followersSnap.docs.map(followDoc => {
        const followerId = followDoc.data().userId;
        return addDoc(collection(db, 'users', followerId, 'notifications'), notificationData);
      });

      await Promise.all(batchPromises);
    } catch (error) {
      console.error('Error notifying followers:', error);
    }
  },

  async notifyFollowersOfPost(ownerName: string, postContent: string) {
    try {
      // For now, posts are global notifications as well as per-user if we wanted
      // But the request didn't specify post notifications for followers.
      // We'll make it a global announcement for now since owners usually post for everyone.
      await addDoc(collection(db, 'global_notifications'), {
        title: ownerName,
        message: postContent,
        type: 'post',
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Error notifying followers of post:', error);
    }
  },

  async notifyAdmin(title: string, message: string, link: string) {
    try {
      await addDoc(collection(db, 'admin_notifications'), {
        title,
        message,
        link,
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Error notifying admin:', error);
    }
  }
};

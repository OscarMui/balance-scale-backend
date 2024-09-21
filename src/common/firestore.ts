import admin from 'firebase-admin';
import { Statistic } from './interfaces';

const createStatistic = async (data: Statistic) => {

  const db = admin.firestore();
    try {
      const docRef = await db.collection('statisticsV1').add(data);
      console.log('Document written with ID:', docRef.id, 'to statisticsV1');
    } catch (error) {
      console.error('Error adding document to statisticsV1:', error);
    }
  }

export {createStatistic};
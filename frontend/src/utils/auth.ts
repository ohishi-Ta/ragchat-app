import { fetchAuthSession } from 'aws-amplify/auth';

export const getCurrentToken = async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('トークン取得エラー:', error);
    return null;
  }
};

export const getUserEmail = (user: any): string => {
  return user?.signInDetails?.loginId || user?.username || user?.attributes?.email;
};